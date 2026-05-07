import { PhoneFrame } from "./phone-frame";

const PAPER = "#fbfaf8";
const TILE = "#fff";
const INK = "#111111";
const ACCENT = "#7b5cf0";
const ACCENT_DEEP = "#2d1b69";
const PINK = "#ff6b9d";
const HIGHLIGHT = "#ffd166";
const TRENDS = "#0dffe8";
const MUTED = "#6d677a";
const HAIR = "rgba(17,17,17,0.10)";

const heroGradient = `linear-gradient(140deg, ${ACCENT_DEEP} 0%, ${ACCENT} 38%, ${PINK} 72%, ${HIGHLIGHT} 100%)`;

export function EditorialShowcase() {
  return (
    <div className="flex flex-nowrap gap-8">
      <PhoneFrame background={PAPER} notchTone="dark">
        <ScreenDashboard />
      </PhoneFrame>
      <PhoneFrame background={PAPER} notchTone="dark">
        <ScreenWardrobe />
      </PhoneFrame>
      <PhoneFrame background={PAPER} notchTone="dark">
        <ScreenTrends />
      </PhoneFrame>
    </div>
  );
}

function TopNav() {
  return (
    <div className="flex items-center justify-between px-5 pt-12">
      <span
        className="font-[var(--font-space)]"
        style={{
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          display: "inline-flex",
          alignItems: "center",
          gap: 6
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 7,
            height: 7,
            background: PINK,
            borderRadius: 999,
            boxShadow: `0 0 0 4px rgba(255,107,157,0.16)`
          }}
        />
        Pocket Wardrobe
      </span>
      <div
        className="flex items-center gap-1 rounded-full"
        style={{
          background: "rgba(255,255,255,0.78)",
          border: `0.5px solid ${HAIR}`,
          padding: 4
        }}
      >
        {["Closet", "Plan", "Trends"].map((l, i) => (
          <span
            key={l}
            className="rounded-full"
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: "5px 10px",
              background: i === 0 ? INK : "transparent",
              color: i === 0 ? "#fffdfc" : MUTED,
              letterSpacing: "0.02em"
            }}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function ScreenDashboard() {
  return (
    <div className="relative h-full w-full" style={{ background: PAPER, color: INK }}>
      <TopNav />
      <div className="px-4 pt-5">
        <p
          className="font-[var(--font-space)]"
          style={{
            fontSize: 9.5,
            color: MUTED,
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            fontWeight: 600
          }}
        >
          Pocket Wardrobe Editorial System
        </p>
        <h1
          className="font-[var(--font-space)] mt-3"
          style={{
            fontSize: 60,
            fontWeight: 700,
            letterSpacing: "-0.105em",
            lineHeight: 0.86,
            textTransform: "uppercase"
          }}
        >
          Dress with
          <br />
          <span
            style={{
              background: `linear-gradient(90deg, ${HIGHLIGHT}, #ecff5a)`,
              padding: "0 4px",
              display: "inline-block"
            }}
          >
            intention
          </span>
        </h1>
        <p
          className="mt-3"
          style={{
            fontSize: 11,
            color: MUTED,
            lineHeight: 1.65,
            letterSpacing: "-0.005em"
          }}
        >
          A wardrobe operating system that turns garments,
          <br />
          wear history, and trends into decisions you can use.
        </p>
      </div>
      <div className="mx-4 mt-5 grid grid-cols-3 gap-2">
        {[
          { l: "Wardrobe", v: 142, s: "owned" },
          { l: "Favourites", v: 28, s: "saved" },
          { l: "Drafts", v: 4, s: "review" }
        ].map((s) => (
          <div
            key={s.l}
            className="rounded-[8px] p-3"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.94), rgba(245,243,255,0.88))",
              border: `0.5px solid ${HAIR}`,
              boxShadow: "0 12px 24px -16px rgba(45,27,105,0.18)"
            }}
          >
            <p
              className="font-[var(--font-space)]"
              style={{
                fontSize: 8,
                fontWeight: 700,
                color: MUTED,
                letterSpacing: "0.28em",
                textTransform: "uppercase"
              }}
            >
              {s.l}
            </p>
            <p
              className="font-[var(--font-space)] mt-1"
              style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.08em" }}
            >
              {s.v}
            </p>
            <p style={{ fontSize: 9, color: MUTED }}>{s.s}</p>
          </div>
        ))}
      </div>
      <div className="px-4 pt-4">
        <div
          className="relative overflow-hidden rounded-[10px]"
          style={{ height: 200, background: heroGradient }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at top right, rgba(13,255,232,0.22), transparent 32%), radial-gradient(circle at top left, rgba(255,255,255,0.24), transparent 28%)"
            }}
          />
          <div className="relative h-full p-4 text-white">
            <p
              className="font-[var(--font-space)]"
              style={{
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.78)"
              }}
            >
              Latest Piece
            </p>
            <p
              className="mt-2 font-[var(--font-space)]"
              style={{
                fontSize: 36,
                fontWeight: 700,
                letterSpacing: "-0.105em",
                lineHeight: 0.88,
                textTransform: "uppercase"
              }}
            >
              Build the
              <br />
              wardrobe issue.
            </p>
            <div className="absolute bottom-3 right-3">
              <span
                className="rounded-full"
                style={{
                  background: "rgba(255,255,255,0.16)",
                  padding: "5px 10px",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  border: "0.5px solid rgba(255,255,255,0.32)"
                }}
              >
                Open →
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between">
          <p
            className="font-[var(--font-space)]"
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: MUTED,
              letterSpacing: "0.28em",
              textTransform: "uppercase"
            }}
          >
            Recent grid
          </p>
          <span
            className="font-[var(--font-space)]"
            style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" }}
          >
            View all →
          </span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {[
            "#1d1c1a",
            "#caa985",
            "#22324d",
            "#e7e1d4"
          ].map((c, i) => (
            <div
              key={i}
              className="aspect-[3/4] rounded-[6px]"
              style={{
                background: c,
                boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.06)"
              }}
            />
          ))}
        </div>
      </div>
      <NavRail />
    </div>
  );
}

function ScreenWardrobe() {
  return (
    <div className="relative h-full w-full" style={{ background: PAPER, color: INK }}>
      <TopNav />
      <div className="px-4 pt-5">
        <p
          className="font-[var(--font-space)]"
          style={{
            fontSize: 9.5,
            color: MUTED,
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            fontWeight: 600
          }}
        >
          The Closet · 142 items
        </p>
        <h1
          className="font-[var(--font-space)] mt-3"
          style={{
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: "-0.105em",
            lineHeight: 0.86,
            textTransform: "uppercase"
          }}
        >
          Every
          <br />
          piece,
          <br />
          <span style={{ color: ACCENT_DEEP }}>indexed.</span>
        </h1>
      </div>
      <div className="mx-4 mt-4 flex gap-1.5 overflow-hidden">
        {["All", "Knits", "Outer", "Trousers", "Shoes"].map((c, i) => (
          <span
            key={c}
            className="rounded-full text-[10px] font-bold"
            style={{
              padding: "5px 10px",
              background: i === 0 ? INK : "rgba(255,255,255,0.86)",
              color: i === 0 ? "#fffdfc" : INK,
              border: i === 0 ? "none" : `0.5px solid ${HAIR}`,
              letterSpacing: "0.06em"
            }}
          >
            {c}
          </span>
        ))}
      </div>
      <div className="mx-4 mt-3 grid grid-cols-2 gap-3">
        {[
          { name: "Cashmere crewneck", code: "K01", swatch: "#1d1c1a", rating: 92 },
          { name: "Camel polo knit", code: "K02", swatch: "#b29063", rating: 88 },
          { name: "Trench — sand", code: "O14", swatch: "#caa985", rating: 95 },
          { name: "Wool trouser", code: "T07", swatch: "#3b3a36", rating: 81 }
        ].map((p) => (
          <div
            key={p.code}
            className="rounded-[10px] overflow-hidden"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.97), rgba(248,246,241,0.94))",
              border: `0.5px solid ${HAIR}`,
              boxShadow: "0 12px 28px -18px rgba(17,17,17,0.18)"
            }}
          >
            <div
              className="relative h-[120px]"
              style={{ background: p.swatch }}
            >
              <span
                className="absolute right-2 top-2 rounded-full text-[9px] font-bold"
                style={{
                  background: "rgba(255,255,255,0.18)",
                  color: "#fff",
                  padding: "3px 7px",
                  border: "0.5px solid rgba(255,255,255,0.32)",
                  letterSpacing: "0.16em"
                }}
              >
                {p.code}
              </span>
              <span
                className="absolute left-2 bottom-2 rounded-full font-[var(--font-space)]"
                style={{
                  background: "#fff",
                  color: INK,
                  padding: "2px 7px",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.06em"
                }}
              >
                ★ {p.rating}
              </span>
            </div>
            <div className="p-2.5">
              <p
                className="font-[var(--font-space)]"
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: "-0.02em"
                }}
              >
                {p.name}
              </p>
              <p
                className="mt-0.5 text-[9px]"
                style={{ color: MUTED, letterSpacing: "0.16em", textTransform: "uppercase" }}
              >
                wool · neutral
              </p>
            </div>
          </div>
        ))}
      </div>
      <NavRail />
    </div>
  );
}

function ScreenTrends() {
  return (
    <div className="relative h-full w-full" style={{ background: PAPER, color: INK }}>
      <TopNav />
      <div className="px-4 pt-5">
        <p
          className="font-[var(--font-space)]"
          style={{
            fontSize: 9.5,
            color: MUTED,
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            fontWeight: 600
          }}
        >
          Trend Layer · live
        </p>
      </div>
      <div className="mx-4 mt-3">
        <div
          className="relative overflow-hidden rounded-[10px]"
          style={{
            background: `linear-gradient(135deg, rgba(19,15,36,0.98), rgba(45,27,105,0.94)), ${heroGradient}`,
            color: "#f7fffd",
            padding: 16
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 78% 24%, rgba(13,255,232,0.32), transparent 18%), radial-gradient(circle at 14% 10%, rgba(255,107,157,0.18), transparent 22%)"
            }}
          />
          <div className="relative">
            <p
              className="font-[var(--font-space)]"
              style={{
                fontSize: 8.5,
                fontWeight: 700,
                color: TRENDS,
                letterSpacing: "0.34em",
                textTransform: "uppercase"
              }}
            >
              Spring 26 · pulse
            </p>
            <h2
              className="font-[var(--font-space)] mt-2"
              style={{
                fontSize: 38,
                fontWeight: 700,
                letterSpacing: "-0.1em",
                lineHeight: 0.9,
                textTransform: "uppercase"
              }}
            >
              Quiet
              <br />
              luxury,
              <br />
              <span style={{ color: TRENDS }}>amplified.</span>
            </h2>
            <p
              className="mt-3 text-[10px]"
              style={{ color: "rgba(247,255,253,0.72)", lineHeight: 1.65 }}
            >
              7 of your pieces are trending up. Cashmere
              <br />
              and trench colourways are leading momentum.
            </p>
          </div>
        </div>
      </div>
      <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
        {[
          { name: "Cashmere", delta: "+18%", c: TRENDS },
          { name: "Trench", delta: "+12%", c: PINK },
          { name: "Loafers", delta: "+09%", c: HIGHLIGHT },
          { name: "Wide-leg", delta: "+06%", c: ACCENT }
        ].map((t) => (
          <div
            key={t.name}
            className="rounded-[10px] p-3"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(231,255,252,0.86))",
              border: `0.5px solid rgba(13,255,232,0.22)`,
              boxShadow: "0 14px 28px -18px rgba(0,88,79,0.18)"
            }}
          >
            <div className="flex items-center justify-between">
              <p
                className="font-[var(--font-space)]"
                style={{
                  fontSize: 8.5,
                  fontWeight: 700,
                  color: MUTED,
                  letterSpacing: "0.28em",
                  textTransform: "uppercase"
                }}
              >
                Signal
              </p>
              <span
                className="font-[var(--font-space)] rounded-full"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  background: t.c,
                  color: INK,
                  padding: "2px 6px",
                  letterSpacing: "0.04em"
                }}
              >
                {t.delta}
              </span>
            </div>
            <p
              className="font-[var(--font-space)] mt-2"
              style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.06em" }}
            >
              {t.name}
            </p>
            <Sparkline />
          </div>
        ))}
      </div>
      <NavRail />
    </div>
  );
}

function Sparkline() {
  return (
    <svg width="100%" height="22" viewBox="0 0 100 22" preserveAspectRatio="none" className="mt-1">
      <polyline
        points="0,18 12,16 24,14 36,11 48,12 60,8 72,9 84,5 96,3"
        fill="none"
        stroke={ACCENT_DEEP}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NavRail() {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-5">
      <div
        className="grid grid-cols-5 rounded-full"
        style={{
          background: "rgba(255,255,255,0.92)",
          border: `0.5px solid ${HAIR}`,
          boxShadow: "0 18px 38px -20px rgba(45,27,105,0.28)",
          padding: 4,
          backdropFilter: "blur(14px)"
        }}
      >
        {[
          { l: "Home", a: false },
          { l: "Closet", a: true },
          { l: "Plan", a: false },
          { l: "Trends", a: false },
          { l: "Profile", a: false }
        ].map((it) => (
          <div
            key={it.l}
            className="flex items-center justify-center rounded-full"
            style={{
              background: it.a ? `linear-gradient(135deg, ${ACCENT}, ${PINK})` : "transparent",
              padding: "8px 0"
            }}
          >
            <span
              className="font-[var(--font-space)]"
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: it.a ? "#fffdfc" : MUTED,
                letterSpacing: "0.04em"
              }}
            >
              {it.l}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
