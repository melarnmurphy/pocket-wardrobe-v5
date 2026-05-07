import { PhoneFrame } from "./phone-frame";

const INK = "#1a1916";
const PAPER = "#f5f2ec";
const TILE = "#eeeae3";
const MUTED = "#807a70";
const HAIRLINE = "rgba(26,25,22,0.12)";

export function AtelierShowcase() {
  return (
    <div className="atelier-root flex flex-nowrap gap-8">
      <PhoneFrame background={PAPER} notchTone="dark">
        <ScreenCloset />
      </PhoneFrame>
      <PhoneFrame background={PAPER} notchTone="dark">
        <ScreenAiOutfits />
      </PhoneFrame>
      <PhoneFrame background={PAPER} notchTone="dark">
        <ScreenCalendar />
      </PhoneFrame>
      <PhoneFrame background={PAPER} notchTone="dark">
        <ScreenTrends />
      </PhoneFrame>
    </div>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center justify-center pt-12">
      <span
        className="font-[var(--font-fraunces)] italic"
        style={{
          fontSize: 30,
          fontWeight: 500,
          color: INK,
          letterSpacing: "-0.04em",
          lineHeight: 1
        }}
      >
        n<span style={{ display: "inline-block", transform: "translate(-1px, 2px)" }}>.</span>
      </span>
    </div>
  );
}

function HamburgerCorner() {
  return (
    <button
      className="absolute right-6 top-12 flex h-7 w-7 items-center justify-center"
      aria-label="Menu"
    >
      <svg width="20" height="14" viewBox="0 0 20 14">
        <line x1="0" y1="2" x2="20" y2="2" stroke={INK} strokeWidth="1.4" />
        <line x1="6" y1="7" x2="20" y2="7" stroke={INK} strokeWidth="1.4" />
        <line x1="0" y1="12" x2="20" y2="12" stroke={INK} strokeWidth="1.4" />
      </svg>
    </button>
  );
}

function TabPair({ active }: { active: "items" | "outfits" }) {
  return (
    <div className="mt-6 flex items-end justify-around px-10">
      <div className="flex flex-col items-center gap-3">
        <span
          className="font-[var(--font-fraunces)]"
          style={{
            fontSize: 17,
            fontWeight: active === "items" ? 600 : 400,
            color: active === "items" ? INK : MUTED,
            letterSpacing: "-0.01em"
          }}
        >
          Items
        </span>
        <div
          style={{
            height: 1.5,
            width: 96,
            background: active === "items" ? INK : "transparent"
          }}
        />
      </div>
      <div className="flex flex-col items-center gap-3">
        <span
          className="font-[var(--font-fraunces)]"
          style={{
            fontSize: 17,
            fontWeight: active === "outfits" ? 600 : 400,
            color: active === "outfits" ? INK : MUTED,
            letterSpacing: "-0.01em"
          }}
        >
          Outfits
        </span>
        <div
          style={{
            height: 1.5,
            width: 96,
            background: active === "outfits" ? INK : "transparent"
          }}
        />
      </div>
    </div>
  );
}

function ScreenCloset() {
  return (
    <div className="relative h-full w-full" style={{ background: PAPER, color: INK }}>
      <Wordmark />
      <HamburgerCorner />
      <TabPair active="outfits" />
      <div className="mt-8 px-6">
        <div className="flex items-center justify-between">
          <p
            className="font-[var(--font-fraunces)]"
            style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em" }}
          >
            Closet · 4 outfits
          </p>
          <div className="flex items-center gap-3 text-[10px]" style={{ color: MUTED }}>
            <Squares /> <Bars /> <Slider />
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 px-6">
        <OutfitTile garments={["sweater", "blazer", "trousers", "heels", "bag"]} bg={TILE} />
        <OutfitTile garments={["sweater", "watch", "trousers-cream", "sneaker"]} bg={TILE} />
        <OutfitTile garments={["turtleneck", "trench", "trousers", "boot", "bag"]} bg={TILE} />
        <OutfitTile garments={["coat-cream", "skirt", "bag-cream", "sunglasses"]} bg={TILE} />
      </div>
      <BottomDock active="closet" />
    </div>
  );
}

function ScreenCalendar() {
  const days = Array.from({ length: 28 }, (_, i) => i + 1);
  return (
    <div className="relative h-full w-full" style={{ background: PAPER, color: INK }}>
      <Wordmark />
      <HamburgerCorner />
      <div className="mt-7 flex justify-around px-2 text-[13px]" style={{ color: MUTED }}>
        {[
          { l: "Casual", a: true },
          { l: "Work", a: false },
          { l: "Dinner", a: false },
          { l: "Evening", a: false },
          { l: "Formal", a: false },
          { l: "Workout", a: false }
        ].map((c) => (
          <span
            key={c.l}
            className="font-[var(--font-fraunces)]"
            style={{
              color: c.a ? INK : MUTED,
              borderBottom: c.a ? `1px solid ${INK}` : "none",
              paddingBottom: 6,
              fontWeight: c.a ? 600 : 400,
              letterSpacing: "-0.01em",
              fontSize: 12.5
            }}
          >
            {c.l}
          </span>
        ))}
      </div>
      <div className="mx-6 mt-4 h-px" style={{ background: HAIRLINE }} />
      <div className="mt-5 flex items-center justify-between px-8">
        <Chevron dir="left" />
        <p
          className="font-[var(--font-fraunces)]"
          style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          February 2026
        </p>
        <Chevron dir="right" />
      </div>
      <div className="mt-5 grid grid-cols-7 gap-2 px-5 text-center" style={{ color: MUTED }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span
            key={i}
            className="font-[var(--font-fraunces)]"
            style={{ fontSize: 12, fontWeight: 500 }}
          >
            {d}
          </span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2 px-5">
        {days.map((d) => {
          const active = d === 10;
          return (
            <div
              key={d}
              className="flex aspect-square items-center justify-center rounded-[8px]"
              style={{
                background: active ? INK : "transparent",
                color: active ? PAPER : INK,
                border: active ? "none" : `0.5px solid ${HAIRLINE}`
              }}
            >
              <span
                className="font-[var(--font-fraunces)]"
                style={{ fontSize: 12.5, fontWeight: active ? 600 : 400 }}
              >
                {d}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex items-center justify-between px-6">
        <p
          className="font-[var(--font-fraunces)]"
          style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em" }}
        >
          Tue, Feb 10th — New Work
        </p>
        <span
          className="flex items-center gap-1 text-[11px]"
          style={{ color: MUTED, letterSpacing: "0.06em" }}
        >
          Edit <PencilGlyph />
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 px-6">
        <FlatItem kind="tee-navy" />
        <FlatItem kind="trousers-charcoal" />
        <FlatItem kind="bomber-black" />
      </div>
      <BottomDock active="calendar" />
    </div>
  );
}

function ScreenAiOutfits() {
  return (
    <div className="relative h-full w-full" style={{ background: PAPER, color: INK }}>
      <Wordmark />
      <HamburgerCorner />
      <div className="mt-8 px-6">
        <p
          className="text-[10px]"
          style={{ color: MUTED, letterSpacing: "0.34em", textTransform: "uppercase" }}
        >
          Today · 18° · light rain
        </p>
        <h1
          className="mt-3 font-[var(--font-fraunces)] italic"
          style={{ fontSize: 38, fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 1.02 }}
        >
          Three looks
          <br />
          for Tuesday.
        </h1>
      </div>
      <div className="mt-7 px-6">
        <div
          className="flex items-end gap-4 rounded-[14px] p-4"
          style={{ background: TILE }}
        >
          <div className="flex-1">
            <p
              className="text-[10px]"
              style={{ color: MUTED, letterSpacing: "0.22em", textTransform: "uppercase" }}
            >
              Suggestion 01
            </p>
            <p
              className="mt-2 font-[var(--font-fraunces)]"
              style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.06 }}
            >
              Soft tailoring,
              <br />
              cream and ink.
            </p>
            <p className="mt-3 text-[11px]" style={{ color: MUTED }}>
              Cashmere knit · Wool trousers · Loafers
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <FlatItem kind="sweater" small />
            <FlatItem kind="trousers-cream" small />
          </div>
        </div>
      </div>
      <div className="mt-3 px-6">
        <div
          className="flex items-end gap-4 rounded-[14px] p-4"
          style={{ background: "#fff", border: `0.5px solid ${HAIRLINE}` }}
        >
          <div className="flex-1">
            <p
              className="text-[10px]"
              style={{ color: MUTED, letterSpacing: "0.22em", textTransform: "uppercase" }}
            >
              Suggestion 02
            </p>
            <p
              className="mt-2 font-[var(--font-fraunces)]"
              style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.06 }}
            >
              The trench
              <br />
              over denim.
            </p>
            <p className="mt-3 text-[11px]" style={{ color: MUTED }}>
              Trench · Tee · Straight-leg jean
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <FlatItem kind="trench" small />
            <FlatItem kind="tee-navy" small />
          </div>
        </div>
      </div>
      <div className="mt-4 px-6">
        <button
          className="w-full rounded-full text-[12px]"
          style={{
            background: INK,
            color: PAPER,
            padding: "14px 0",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontWeight: 600
          }}
        >
          Generate another
        </button>
      </div>
      <BottomDock active="ai" />
    </div>
  );
}

function ScreenTrends() {
  const signals = [
    { name: "Cashmere", delta: "+18%", own: 6, points: [16, 14, 11, 13, 9, 10, 6, 4] },
    { name: "Trench coat", delta: "+12%", own: 2, points: [14, 13, 12, 9, 11, 7, 6, 5] },
    { name: "Loafers", delta: "+09%", own: 4, points: [12, 14, 10, 11, 8, 9, 7, 5] },
    { name: "Wide-leg", delta: "+06%", own: 5, points: [13, 12, 13, 11, 10, 8, 9, 7] }
  ];
  return (
    <div className="relative h-full w-full" style={{ background: PAPER, color: INK }}>
      <Wordmark />
      <HamburgerCorner />
      <div className="mt-7 px-6">
        <p
          className="text-[10px]"
          style={{ color: MUTED, letterSpacing: "0.34em", textTransform: "uppercase" }}
        >
          Spring 26 · Pulse
        </p>
        <h1
          className="mt-3 font-[var(--font-fraunces)]"
          style={{
            fontSize: 38,
            fontWeight: 400,
            letterSpacing: "-0.03em",
            lineHeight: 1.0
          }}
        >
          Quiet luxury,
          <br />
          <span style={{ fontStyle: "italic" }}>amplified.</span>
        </h1>
        <p
          className="mt-3 text-[11px]"
          style={{ color: MUTED, lineHeight: 1.6 }}
        >
          Seven of your pieces are trending up.
          <br />
          Your wardrobe leans into the moment.
        </p>
      </div>
      <div className="mx-6 mt-5 h-px" style={{ background: HAIRLINE }} />
      <div className="mt-4 grid grid-cols-2 gap-3 px-6">
        {signals.map((s) => (
          <div
            key={s.name}
            className="rounded-[14px] p-3"
            style={{ background: TILE }}
          >
            <div className="flex items-baseline justify-between">
              <p
                className="text-[9.5px]"
                style={{
                  color: MUTED,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase"
                }}
              >
                Signal
              </p>
              <span
                className="font-[var(--font-fraunces)] italic"
                style={{ fontSize: 13, fontWeight: 500, letterSpacing: "-0.01em" }}
              >
                {s.delta}
              </span>
            </div>
            <p
              className="mt-2 font-[var(--font-fraunces)]"
              style={{
                fontSize: 17,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                lineHeight: 1.05
              }}
            >
              {s.name}
            </p>
            <Sparkline points={s.points} />
            <p
              className="mt-1 text-[10px]"
              style={{ color: MUTED }}
            >
              {s.own} owned · {s.own >= 4 ? "covered" : "consider"}
            </p>
          </div>
        ))}
      </div>
      <div className="mx-6 mt-4 h-px" style={{ background: HAIRLINE }} />
      <div className="mt-3 flex items-center justify-between px-6">
        <p
          className="font-[var(--font-fraunces)]"
          style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em" }}
        >
          <span style={{ fontStyle: "italic" }}>Story</span> · The new neutrals
        </p>
        <span
          className="text-[10px]"
          style={{ color: MUTED, letterSpacing: "0.18em", textTransform: "uppercase" }}
        >
          Read →
        </span>
      </div>
      <BottomDock active="trends" />
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const max = 18;
  const w = 100;
  const h = 22;
  const step = w / (points.length - 1);
  const path = points
    .map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${(v / max) * h}`)
    .join(" ");
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="mt-2"
    >
      <path
        d={path}
        fill="none"
        stroke={INK}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BottomDock({ active }: { active: "closet" | "ai" | "calendar" | "trends" }) {
  const items = [
    { id: "closet", label: "Closet", icon: <HangerGlyph /> },
    { id: "ai", label: "Planner", icon: <TeeGlyph /> },
    { id: "calendar", label: "Calendar", icon: <CalGlyph /> },
    { id: "trends", label: "Trends", icon: <TrendGlyph /> }
  ] as const;
  return (
    <div className="absolute inset-x-0 bottom-0 z-20">
      <div className="relative h-[100px]">
        <div
          className="absolute inset-x-0 bottom-0 h-[88px]"
          style={{
            background: PAPER,
            borderTop: `0.5px solid ${HAIRLINE}`
          }}
        />
        <div
          className="absolute left-1/2 top-1 -translate-x-1/2"
          style={{
            width: 60,
            height: 60,
            borderRadius: 999,
            background: INK,
            boxShadow: "0 12px 28px -10px rgba(26,25,22,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20">
            <line x1="10" y1="2" x2="10" y2="18" stroke={PAPER} strokeWidth="1.5" strokeLinecap="round" />
            <line x1="2" y1="10" x2="18" y2="10" stroke={PAPER} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="absolute inset-x-0 bottom-0 grid h-[88px] grid-cols-4 items-center px-2 pt-3">
          {items.map((it, i) => {
            const isActive = it.id === active;
            const isCenter = i === 1 || i === 2;
            return (
              <div
                key={it.id}
                className="flex flex-col items-center gap-1"
                style={{
                  paddingLeft: i === 2 ? 24 : 0,
                  paddingRight: i === 1 ? 24 : 0,
                  color: isActive ? INK : MUTED
                }}
              >
                <div style={{ opacity: isActive ? 1 : 0.65 }}>{it.icon}</div>
                <span
                  className="font-[var(--font-fraunces)]"
                  style={{
                    fontSize: 10.5,
                    fontWeight: isActive ? 600 : 400,
                    letterSpacing: "-0.01em"
                  }}
                >
                  {it.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* --- Glyphs & flat items --- */

function HangerGlyph() {
  return (
    <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
      <path
        d="M11 6c0-1.5 1.2-2.7 2.7-2.7S16.4 4.5 16.4 6c0 .8-.4 1.5-1 1.9L11 11l-9.5 5.4a1 1 0 00.5 1.9h18a1 1 0 00.5-1.9L11 11"
        stroke={INK}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function TeeGlyph() {
  return (
    <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
      <path
        d="M3 4l4-2 1.5 2h5L15 2l4 2 2 4-3 1v7H4v-7L1 8l2-4z"
        stroke={INK}
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
function CalGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="4" width="16" height="14" rx="3" stroke={INK} strokeWidth="1.3" />
      <rect x="2" y="4" width="16" height="4" rx="2" fill={INK} />
      <line x1="6" y1="2" x2="6" y2="6" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
      <line x1="14" y1="2" x2="14" y2="6" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function TrendGlyph() {
  return (
    <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
      <polyline
        points="1,14 6,10 10,12 14,5 18,7 21,3"
        stroke={INK}
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M21 3l-3 0M21 3l0 3" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function PencilGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M1 10l1.4-3.5L8.5 1l1.5 1.5L4 8.6 1 10z" stroke={INK} strokeWidth="0.9" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
function Squares() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <rect x="0.5" y="0.5" width="5.5" height="5.5" stroke={INK} strokeWidth="1" fill="none" />
      <rect x="8" y="0.5" width="5.5" height="5.5" stroke={INK} strokeWidth="1" fill="none" />
      <rect x="0.5" y="8" width="5.5" height="5.5" stroke={INK} strokeWidth="1" fill="none" />
      <rect x="8" y="8" width="5.5" height="5.5" stroke={INK} strokeWidth="1" fill="none" />
    </svg>
  );
}
function Bars() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <rect x="1" y="9" width="3" height="4" fill={INK} />
      <rect x="6" y="5" width="3" height="8" fill={INK} />
      <rect x="11" y="2" width="3" height="11" fill={INK} />
    </svg>
  );
}
function Slider() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <line x1="0" y1="3" x2="14" y2="3" stroke={INK} strokeWidth="1.1" />
      <line x1="0" y1="11" x2="14" y2="11" stroke={INK} strokeWidth="1.1" />
      <circle cx="9" cy="3" r="2" fill={PAPER} stroke={INK} strokeWidth="1.1" />
      <circle cx="4" cy="11" r="2" fill={PAPER} stroke={INK} strokeWidth="1.1" />
    </svg>
  );
}
function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ transform: dir === "right" ? "scaleX(-1)" : "none" }}>
      <path d="M9 1L3 7l6 6" stroke={INK} strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OutfitTile({ garments, bg }: { garments: string[]; bg: string }) {
  return (
    <div
      className="relative aspect-[3/4] overflow-hidden rounded-[12px]"
      style={{ background: bg }}
    >
      <div className="grid h-full grid-cols-2 gap-1 p-2.5">
        {garments.slice(0, 4).map((g, i) => (
          <div key={i} className="flex items-center justify-center">
            <FlatItem kind={g} />
          </div>
        ))}
      </div>
    </div>
  );
}

type FlatKind =
  | "sweater"
  | "blazer"
  | "trousers"
  | "trousers-cream"
  | "trousers-charcoal"
  | "heels"
  | "bag"
  | "bag-cream"
  | "watch"
  | "sneaker"
  | "turtleneck"
  | "trench"
  | "boot"
  | "coat-cream"
  | "skirt"
  | "sunglasses"
  | "tee-navy"
  | "bomber-black"
  | string;

function FlatItem({ kind, small = false }: { kind: FlatKind; small?: boolean }) {
  const w = small ? 44 : 58;
  const h = small ? 56 : 72;
  return <ItemSvg kind={kind} w={w} h={h} />;
}

function ItemSvg({ kind, w, h }: { kind: FlatKind; w: number; h: number }) {
  const fill = ((): string => {
    switch (kind) {
      case "sweater":
      case "turtleneck":
        return "#1d1c1a";
      case "blazer":
      case "bomber-black":
        return "#15140f";
      case "trousers":
        return "#9f9b95";
      case "trousers-cream":
        return "#e7e1d4";
      case "trousers-charcoal":
        return "#3b3a36";
      case "heels":
      case "boot":
        return "#1a1916";
      case "bag":
        return "#a8a39a";
      case "bag-cream":
        return "#d8d2c3";
      case "watch":
        return "#5a564f";
      case "sneaker":
        return "#f1ece2";
      case "trench":
        return "#caa985";
      case "coat-cream":
        return "#ece6d8";
      case "skirt":
        return "#1f1d1a";
      case "sunglasses":
        return "#1d1b16";
      case "tee-navy":
        return "#22324d";
      default:
        return "#888";
    }
  })();

  switch (kind) {
    case "sweater":
    case "turtleneck":
      return (
        <svg width={w} height={h} viewBox="0 0 60 70">
          <path
            d="M16 8c0-3 5-6 14-6s14 3 14 6l8 6-3 12h-3v34H14V26h-3l-3-12z"
            fill={fill}
          />
          {kind === "turtleneck" && (
            <rect x="22" y="1" width="16" height="9" rx="2.5" fill={fill} />
          )}
        </svg>
      );
    case "blazer":
      return (
        <svg width={w} height={h} viewBox="0 0 60 70">
          <path d="M14 8L28 4l4 6 4-6 14 4-3 12-3 1v33H17V25l-3-1-3-12 3-4z" fill={fill} />
          <line x1="30" y1="10" x2="30" y2="58" stroke={PAPER} strokeWidth="0.6" />
        </svg>
      );
    case "trousers":
    case "trousers-cream":
    case "trousers-charcoal":
      return (
        <svg width={w} height={h} viewBox="0 0 60 70">
          <path
            d="M14 6h32l-2 12-3 46h-9l-2-32-2 32h-9l-3-46-2-12z"
            fill={fill}
          />
        </svg>
      );
    case "heels":
      return (
        <svg width={w} height={h} viewBox="0 0 60 70">
          <path d="M6 36l28-2 18-4v8l-3 6H10c-3 0-4-3-4-8z" fill={fill} />
          <rect x="38" y="38" width="2" height="22" fill={fill} />
        </svg>
      );
    case "bag":
    case "bag-cream":
      return (
        <svg width={w} height={h} viewBox="0 0 60 70">
          <path d="M10 22c14-12 26-12 40 0v32H10z" fill={fill} />
          <path d="M22 22c0-9 4-14 8-14s8 5 8 14" stroke={fill} strokeWidth="2.4" fill="none" />
        </svg>
      );
    case "watch":
      return (
        <svg width={w} height={h} viewBox="0 0 60 70">
          <rect x="22" y="2" width="16" height="14" fill={fill} />
          <rect x="18" y="16" width="24" height="36" rx="4" fill={fill} />
          <rect x="22" y="52" width="16" height="14" fill={fill} />
          <circle cx="30" cy="34" r="9" fill={PAPER} />
        </svg>
      );
    case "sneaker":
      return (
        <svg width={w} height={h} viewBox="0 0 60 70">
          <path d="M2 38c2-10 14-16 28-14s24 4 28 12c2 6-1 14-12 14H10c-6 0-9-4-8-12z" fill={fill} stroke={INK} strokeWidth="1" />
        </svg>
      );
    case "trench":
      return (
        <svg width={w} height={h} viewBox="0 0 60 70">
          <path d="M14 8L28 4v62h-12V25l-4-1-2-12 4-4zm32 0L32 4v62h12V25l4-1 2-12-4-4z" fill={fill} />
          <rect x="29" y="6" width="2" height="60" fill="#a3855d" />
        </svg>
      );
    case "boot":
      return (
        <svg width={w} height={h} viewBox="0 0 60 70">
          <path d="M16 4h14v36c8 4 18 8 24 14H10c-2-4 0-12 6-14V4z" fill={fill} />
        </svg>
      );
    case "coat-cream":
      return (
        <svg width={w} height={h} viewBox="0 0 60 70">
          <path d="M14 8l14-4 2 6 2-6 14 4-3 12-3 1v33H17V25l-3-1-3-12 3-4z" fill={fill} stroke="#b9b1a0" strokeWidth="0.8" />
          <line x1="30" y1="10" x2="30" y2="58" stroke="#b9b1a0" strokeWidth="0.8" />
        </svg>
      );
    case "skirt":
      return (
        <svg width={w} height={h} viewBox="0 0 60 70">
          <path d="M16 4h28l8 60H8z" fill={fill} />
        </svg>
      );
    case "sunglasses":
      return (
        <svg width={w} height={h} viewBox="0 0 60 70">
          <ellipse cx="18" cy="36" rx="10" ry="7" fill={fill} />
          <ellipse cx="42" cy="36" rx="10" ry="7" fill={fill} />
          <line x1="28" y1="36" x2="32" y2="36" stroke={fill} strokeWidth="2" />
        </svg>
      );
    case "tee-navy":
      return (
        <svg width={w} height={h} viewBox="0 0 60 70">
          <path d="M14 8l8-4 4 6h8l4-6 8 4 6 8-4 4h-3v34H17V20h-3l-4-4 6-8z" fill={fill} />
        </svg>
      );
    case "bomber-black":
      return (
        <svg width={w} height={h} viewBox="0 0 60 70">
          <path d="M12 8L24 4l6 6 6-6 12 4-2 14-4 1v33H18V27l-4-1-4-14 2-4z" fill={fill} />
          <rect x="14" y="20" width="32" height="2" fill="#3a3a36" />
          <rect x="14" y="50" width="32" height="2" fill="#3a3a36" />
        </svg>
      );
    default:
      return <div style={{ width: w, height: h, background: "#ddd", borderRadius: 6 }} />;
  }
}
