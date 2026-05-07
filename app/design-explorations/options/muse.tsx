import { PhoneFrame } from "./phone-frame";

const PAPER = "#faf6f1";
const TILE = "#f1ebe1";
const INK = "#2c1f1b";
const ACCENT = "#b8855b";
const ACCENT_SOFT = "#e8d3bd";
const MUTED = "#9a8a7e";
const HAIR = "rgba(44,31,27,0.10)";

export function MuseShowcase() {
  return (
    <div className="flex flex-nowrap gap-8">
      <PhoneFrame background={PAPER} notchTone="dark">
        <ScreenHome />
      </PhoneFrame>
      <PhoneFrame background={PAPER} notchTone="dark">
        <ScreenLookbook />
      </PhoneFrame>
      <PhoneFrame background={PAPER} notchTone="dark">
        <ScreenPlanner />
      </PhoneFrame>
    </div>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center justify-center pt-12">
      <span
        className="font-[var(--font-cormorant)] italic"
        style={{
          fontSize: 32,
          fontWeight: 500,
          color: INK,
          letterSpacing: "-0.02em",
          lineHeight: 1
        }}
      >
        muse
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
        <line x1="0" y1="3" x2="20" y2="3" stroke={INK} strokeWidth="1" strokeLinecap="round" />
        <line x1="6" y1="11" x2="20" y2="11" stroke={INK} strokeWidth="1" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function ScreenHome() {
  return (
    <div className="relative h-full w-full" style={{ background: PAPER, color: INK }}>
      <Wordmark />
      <HamburgerCorner />
      <div className="px-6 pt-8">
        <p
          className="font-[var(--font-cormorant)] italic"
          style={{ fontSize: 13, color: ACCENT, letterSpacing: "0.04em" }}
        >
          Tuesday, the tenth
        </p>
        <h1
          className="mt-2 font-[var(--font-cormorant)]"
          style={{ fontSize: 48, fontWeight: 400, letterSpacing: "-0.025em", lineHeight: 1.0 }}
        >
          Good
          <br />
          morning,
          <br />
          <span style={{ fontStyle: "italic" }}>Eloise.</span>
        </h1>
      </div>
      <div className="mt-6 px-6">
        <div
          className="rounded-[20px] p-5"
          style={{
            background: "#fff",
            boxShadow: "0 14px 32px -16px rgba(44,31,27,0.18)"
          }}
        >
          <div className="flex items-center justify-between">
            <p
              className="text-[10px]"
              style={{ color: MUTED, letterSpacing: "0.22em", textTransform: "uppercase" }}
            >
              Today's edit
            </p>
            <span
              className="rounded-full"
              style={{ background: ACCENT_SOFT, padding: "3px 10px" }}
            >
              <span
                className="font-[var(--font-cormorant)] italic"
                style={{ fontSize: 11, color: INK, letterSpacing: "0.02em" }}
              >
                3 looks
              </span>
            </span>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <div className="flex-1">
              <p
                className="font-[var(--font-cormorant)]"
                style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.05 }}
              >
                Wool, suede,
                <br />
                <span style={{ fontStyle: "italic", color: ACCENT }}>and a touch of gold.</span>
              </p>
              <p
                className="mt-3 text-[11px]"
                style={{ color: MUTED, lineHeight: 1.5 }}
              >
                Soft tailoring for a 9° morning. Brought
                <br />
                forward from your spring capsule.
              </p>
            </div>
            <SoftItem kind="trench" w={62} h={88} />
          </div>
        </div>
      </div>
      <div className="mt-5 px-6">
        <div className="flex items-center justify-between">
          <p
            className="font-[var(--font-cormorant)]"
            style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.01em" }}
          >
            <span style={{ fontStyle: "italic" }}>Your</span> recent pieces
          </p>
          <span className="text-[10px]" style={{ color: ACCENT, letterSpacing: "0.18em", textTransform: "uppercase" }}>
            View all
          </span>
        </div>
        <div className="mt-3 flex gap-2 overflow-hidden">
          <RecentChip kind="sweater" tone={TILE} />
          <RecentChip kind="trousers-cream" tone="#fff" />
          <RecentChip kind="bag-cream" tone={ACCENT_SOFT} />
          <RecentChip kind="heels" tone={TILE} />
        </div>
      </div>
      <BottomDockMuse active="home" />
    </div>
  );
}

function ScreenLookbook() {
  return (
    <div className="relative h-full w-full" style={{ background: PAPER, color: INK }}>
      <Wordmark />
      <HamburgerCorner />
      <div className="mt-8 px-6">
        <p
          className="text-[10px]"
          style={{ color: ACCENT, letterSpacing: "0.28em", textTransform: "uppercase" }}
        >
          The lookbook
        </p>
        <h2
          className="mt-2 font-[var(--font-cormorant)]"
          style={{ fontSize: 38, fontWeight: 400, letterSpacing: "-0.025em", lineHeight: 0.96 }}
        >
          Saved
          <br />
          <span style={{ fontStyle: "italic" }}>silhouettes</span>
        </h2>
      </div>
      <div className="mt-5 flex gap-2 px-6">
        {["All", "Daywear", "Evening", "Travel", "Bridal"].map((c, i) => (
          <span
            key={c}
            className="rounded-full text-[11px]"
            style={{
              padding: "6px 12px",
              background: i === 1 ? INK : "transparent",
              border: i === 1 ? "none" : `0.5px solid ${HAIR}`,
              color: i === 1 ? PAPER : INK,
              fontStyle: "italic",
              fontFamily: "var(--font-cormorant)"
            }}
          >
            <span style={{ display: "inline-block", width: 4, height: 4, borderRadius: 999, background: i === 1 ? ACCENT : MUTED, marginRight: 6, verticalAlign: "middle" }} />
            {c}
          </span>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 px-6">
        {[
          { name: "The cream coat", date: "Jan 28", bg: ACCENT_SOFT, items: ["coat-cream", "trousers-cream", "bag-cream", "heels"] },
          { name: "After-eight", date: "Feb 02", bg: "#1a1614", items: ["blazer", "skirt", "heels", "bag"], dark: true },
          { name: "Café Sunday", date: "Feb 04", bg: TILE, items: ["sweater", "trousers", "sneaker", "watch"] },
          { name: "The trench", date: "Feb 09", bg: "#fff", items: ["trench", "tee-navy", "trousers-charcoal", "boot"] }
        ].map((look) => (
          <div
            key={look.name}
            className="rounded-[18px] overflow-hidden"
            style={{
              background: look.bg,
              boxShadow: "0 12px 28px -16px rgba(44,31,27,0.18)"
            }}
          >
            <div className="grid grid-cols-2 gap-1 p-3" style={{ aspectRatio: "1 / 1.05" }}>
              {look.items.slice(0, 4).map((g, j) => (
                <div key={j} className="flex items-center justify-center">
                  <SoftItem kind={g} w={42} h={52} darkBg={look.dark} />
                </div>
              ))}
            </div>
            <div
              className="px-3 pb-3"
              style={{ color: look.dark ? "#f3ede2" : INK }}
            >
              <p
                className="font-[var(--font-cormorant)]"
                style={{ fontSize: 14.5, fontWeight: 500, letterSpacing: "-0.01em" }}
              >
                {look.name}
              </p>
              <p
                className="mt-0.5 text-[10px]"
                style={{ color: look.dark ? "rgba(243,237,226,0.6)" : MUTED, letterSpacing: "0.14em", textTransform: "uppercase" }}
              >
                {look.date}
              </p>
            </div>
          </div>
        ))}
      </div>
      <BottomDockMuse active="lookbook" />
    </div>
  );
}

function ScreenPlanner() {
  return (
    <div className="relative h-full w-full" style={{ background: PAPER, color: INK }}>
      <Wordmark />
      <HamburgerCorner />
      <div className="mt-8 px-6">
        <p
          className="text-[10px]"
          style={{ color: ACCENT, letterSpacing: "0.28em", textTransform: "uppercase" }}
        >
          The week ahead
        </p>
        <h2
          className="mt-2 font-[var(--font-cormorant)]"
          style={{ fontSize: 36, fontWeight: 400, letterSpacing: "-0.025em", lineHeight: 0.96 }}
        >
          February
          <br />
          <span style={{ fontStyle: "italic" }}>tenth</span>
          <span style={{ color: MUTED }}>—sixteenth</span>
        </h2>
      </div>
      <div className="mt-5 flex gap-2 overflow-hidden px-6">
        {[
          { d: "Tue", n: 10, active: true },
          { d: "Wed", n: 11, active: false },
          { d: "Thu", n: 12, active: false },
          { d: "Fri", n: 13, active: false },
          { d: "Sat", n: 14, active: false }
        ].map((day) => (
          <div
            key={day.n}
            className="rounded-[16px] py-3 text-center"
            style={{
              flex: 1,
              minWidth: 50,
              background: day.active ? INK : "transparent",
              border: day.active ? "none" : `0.5px solid ${HAIR}`,
              color: day.active ? PAPER : INK
            }}
          >
            <p
              className="text-[10px]"
              style={{
                color: day.active ? "rgba(250,246,241,0.7)" : MUTED,
                letterSpacing: "0.16em",
                textTransform: "uppercase"
              }}
            >
              {day.d}
            </p>
            <p
              className="font-[var(--font-cormorant)] mt-1"
              style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}
            >
              {day.n}
            </p>
            <span
              className="mt-1 inline-block"
              style={{
                width: 4,
                height: 4,
                borderRadius: 999,
                background: day.active ? ACCENT : "transparent"
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-5 px-6">
        <div
          className="rounded-[20px] p-5"
          style={{
            background: "#fff",
            boxShadow: "0 14px 30px -18px rgba(44,31,27,0.18)"
          }}
        >
          <div className="flex items-center justify-between">
            <p
              className="font-[var(--font-cormorant)]"
              style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-0.01em" }}
            >
              <span style={{ fontStyle: "italic" }}>Tue</span> · 09:30 — Studio
            </p>
            <span
              className="rounded-full text-[10px]"
              style={{
                background: ACCENT_SOFT,
                padding: "4px 10px",
                color: INK,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                fontFamily: "var(--font-cormorant)",
                fontStyle: "italic"
              }}
            >
              new
            </span>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <div className="flex flex-1 gap-2">
              <SoftTile kind="tee-navy" />
              <SoftTile kind="trousers-charcoal" />
              <SoftTile kind="bomber-black" />
              <SoftTile kind="boot" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p
              className="text-[10px]"
              style={{ color: MUTED, letterSpacing: "0.14em", textTransform: "uppercase" }}
            >
              Match score
            </p>
            <p
              className="font-[var(--font-cormorant)] italic"
              style={{ fontSize: 14, color: ACCENT, fontWeight: 500 }}
            >
              94 — quietly perfect
            </p>
          </div>
        </div>
      </div>
      <div className="mt-3 px-6">
        <div
          className="flex items-center justify-between rounded-[20px] p-4"
          style={{ background: TILE }}
        >
          <div>
            <p
              className="text-[10px]"
              style={{ color: MUTED, letterSpacing: "0.18em", textTransform: "uppercase" }}
            >
              Wed evening
            </p>
            <p
              className="font-[var(--font-cormorant)] mt-1"
              style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.01em" }}
            >
              <span style={{ fontStyle: "italic" }}>Dinner</span> — Frankie's
            </p>
          </div>
          <span
            className="rounded-full text-[10px]"
            style={{
              border: `0.5px solid ${INK}`,
              padding: "4px 10px",
              fontFamily: "var(--font-cormorant)",
              fontStyle: "italic"
            }}
          >
            Plan look
          </span>
        </div>
      </div>
      <BottomDockMuse active="planner" />
    </div>
  );
}

function BottomDockMuse({ active }: { active: "home" | "lookbook" | "planner" | "ai" }) {
  const items = [
    { id: "home", label: "Home" },
    { id: "lookbook", label: "Looks" },
    { id: "planner", label: "Plan" },
    { id: "ai", label: "Muse AI" }
  ] as const;
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-5">
      <div
        className="grid grid-cols-4 rounded-full"
        style={{
          background: "#fff",
          boxShadow: "0 16px 38px -18px rgba(44,31,27,0.22)",
          padding: 6
        }}
      >
        {items.map((it) => {
          const isActive = it.id === active;
          return (
            <div
              key={it.id}
              className="flex items-center justify-center rounded-full"
              style={{
                background: isActive ? INK : "transparent",
                color: isActive ? PAPER : INK,
                padding: "10px 0"
              }}
            >
              <span
                className="font-[var(--font-cormorant)]"
                style={{
                  fontSize: 12.5,
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
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

function RecentChip({ kind, tone }: { kind: string; tone: string }) {
  return (
    <div
      className="flex flex-1 items-center justify-center rounded-[16px]"
      style={{
        background: tone,
        aspectRatio: "3 / 4",
        boxShadow: "0 8px 18px -12px rgba(44,31,27,0.18)"
      }}
    >
      <SoftItem kind={kind} w={48} h={62} />
    </div>
  );
}

function SoftTile({ kind }: { kind: string }) {
  return (
    <div
      className="flex flex-1 items-center justify-center rounded-[12px]"
      style={{ background: TILE, aspectRatio: "3 / 4" }}
    >
      <SoftItem kind={kind} w={36} h={48} />
    </div>
  );
}

function SoftItem({
  kind,
  w,
  h,
  darkBg = false
}: {
  kind: string;
  w: number;
  h: number;
  darkBg?: boolean;
}) {
  const colorMap: Record<string, string> = {
    sweater: "#1d1c1a",
    "turtleneck": "#1d1c1a",
    "trousers": "#9f9b95",
    "trousers-cream": "#e7e1d4",
    "trousers-charcoal": "#3b3a36",
    "heels": "#1a1916",
    "bag": "#a8a39a",
    "bag-cream": "#d8d2c3",
    "trench": "#caa985",
    "coat-cream": "#ece6d8",
    "skirt": "#1f1d1a",
    "tee-navy": "#22324d",
    "bomber-black": "#15140f",
    "boot": "#1a1916",
    "blazer": "#15140f",
    "watch": "#5a564f",
    "sneaker": "#f1ece2"
  };
  const fill = colorMap[kind] ?? "#888";

  switch (kind) {
    case "sweater":
    case "turtleneck":
      return (
        <svg width={w} height={h} viewBox="0 0 60 70">
          <path
            d="M16 8c0-3 5-6 14-6s14 3 14 6l8 6-3 12h-3v34H14V26h-3l-3-12z"
            fill={fill}
          />
          {kind === "turtleneck" && <rect x="22" y="1" width="16" height="9" rx="2.5" fill={fill} />}
        </svg>
      );
    case "blazer":
      return (
        <svg width={w} height={h} viewBox="0 0 60 70">
          <path d="M14 8L28 4l4 6 4-6 14 4-3 12-3 1v33H17V25l-3-1-3-12 3-4z" fill={fill} />
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
            stroke={darkBg ? "rgba(255,255,255,0.1)" : "none"}
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
          <path d="M14 8l14-4 2 6 2-6 14 4-3 12-3 1v33H17V25l-3-1-3-12 3-4z" fill={fill} />
        </svg>
      );
    case "skirt":
      return (
        <svg width={w} height={h} viewBox="0 0 60 70">
          <path d="M16 4h28l8 60H8z" fill={fill} />
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
          <path d="M2 38c2-10 14-16 28-14s24 4 28 12c2 6-1 14-12 14H10c-6 0-9-4-8-12z" fill={fill} stroke={INK} strokeWidth="0.8" />
        </svg>
      );
    default:
      return <div style={{ width: w, height: h, background: "#ddd", borderRadius: 6 }} />;
  }
}
