import type { ReactNode } from "react";

type PhoneFrameProps = {
  children: ReactNode;
  background?: string;
  notchTone?: "dark" | "light";
};

export function PhoneFrame({ children, background = "#ffffff", notchTone = "dark" }: PhoneFrameProps) {
  return (
    <div className="relative shrink-0">
      <div
        className="relative overflow-hidden rounded-[44px] border border-black/10 shadow-[0_30px_80px_-30px_rgba(15,12,8,0.35),0_8px_24px_-12px_rgba(15,12,8,0.18)]"
        style={{
          width: 360,
          height: 760,
          background,
          padding: 8
        }}
      >
        <div
          className="relative h-full w-full overflow-hidden rounded-[36px]"
          style={{ background }}
        >
          <StatusBar tone={notchTone} />
          {children}
        </div>
      </div>
    </div>
  );
}

function StatusBar({ tone }: { tone: "dark" | "light" }) {
  const ink = tone === "dark" ? "#111111" : "#ffffff";
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-7 pt-3.5"
      style={{ color: ink }}
    >
      <span className="text-[13px] font-semibold tabular-nums" style={{ letterSpacing: "-0.01em" }}>
        9:41
      </span>
      <div className="flex items-center gap-1.5">
        <SignalGlyph color={ink} />
        <WifiGlyph color={ink} />
        <BatteryGlyph color={ink} />
      </div>
    </div>
  );
}

function SignalGlyph({ color }: { color: string }) {
  return (
    <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
      <rect x="0" y="7" width="2.5" height="3" rx="0.5" fill={color} />
      <rect x="3.8" y="5" width="2.5" height="5" rx="0.5" fill={color} />
      <rect x="7.6" y="3" width="2.5" height="7" rx="0.5" fill={color} />
      <rect x="11.4" y="0" width="2.5" height="10" rx="0.5" fill={color} />
    </svg>
  );
}

function WifiGlyph({ color }: { color: string }) {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
      <path
        d="M7 8.5a1 1 0 100-2 1 1 0 000 2zM2.4 4.2a6.5 6.5 0 019.2 0M4.6 6.4a3.4 3.4 0 014.8 0"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BatteryGlyph({ color }: { color: string }) {
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" fill="none">
      <rect x="0.5" y="0.5" width="18" height="9" rx="2.5" stroke={color} strokeOpacity="0.55" />
      <rect x="2" y="2" width="13" height="6" rx="1.2" fill={color} />
      <rect x="20" y="3.5" width="1.5" height="3" rx="0.6" fill={color} fillOpacity="0.6" />
    </svg>
  );
}
