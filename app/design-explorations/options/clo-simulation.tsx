import { Activity, Droplets, Layers3, Move3D, Ruler, Scissors, Shirt, Wind } from "lucide-react";
import type { ReactNode } from "react";

import { PhoneFrame } from "./phone-frame";

const INK = "#111315";
const PAPER = "#f7f7f2";
const PANEL = "#ffffff";
const LINE = "rgba(17,19,21,0.12)";
const MUTED = "#6d7378";
const CYAN = "#2ab7c6";
const AMBER = "#d5962f";
const CLAY = "#b85f42";
const GRAPHITE = "#23282d";

export function ClothSimulationShowcase() {
  return (
    <div className="flex flex-nowrap gap-8">
      <PhoneFrame background={PAPER} notchTone="dark">
        <SimulationWorkspace />
      </PhoneFrame>
      <PhoneFrame background={PAPER} notchTone="dark">
        <MaterialPhysics />
      </PhoneFrame>
      <PhoneFrame background={PAPER} notchTone="dark">
        <FitReview />
      </PhoneFrame>
    </div>
  );
}

function Header({ title, eyebrow }: { title: string; eyebrow: string }) {
  return (
    <div className="px-5 pt-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase" style={{ color: MUTED, letterSpacing: 0 }}>
            {eyebrow}
          </p>
          <h1 className="mt-1 font-[var(--font-space)] text-[28px] font-semibold leading-[1.05]" style={{ letterSpacing: 0 }}>
            {title}
          </h1>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-[8px]" style={{ background: GRAPHITE, color: PAPER }}>
          <Shirt size={18} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  active,
  children
}: {
  label: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-[8px]"
      style={{
        background: active ? GRAPHITE : PANEL,
        border: `0.5px solid ${active ? GRAPHITE : LINE}`,
        color: active ? PAPER : INK
      }}
    >
      {children}
    </button>
  );
}

function SimulationWorkspace() {
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: PAPER, color: INK }}>
      <Header eyebrow="3D garment lab" title="Drape check" />

      <div className="mx-5 mt-4 flex items-center justify-between">
        <div className="flex gap-2">
          <IconButton label="Move tool" active>
            <Move3D size={17} />
          </IconButton>
          <IconButton label="Pattern cut">
            <Scissors size={17} />
          </IconButton>
          <IconButton label="Measure">
            <Ruler size={17} />
          </IconButton>
        </div>
        <div className="rounded-[8px] px-3 py-2 text-[11px] font-semibold" style={{ background: "#e8f7f8", color: "#106671" }}>
          Live fit
        </div>
      </div>

      <div className="relative mx-5 mt-5 h-[430px] overflow-hidden rounded-[20px]" style={{ background: "#dfe3e4", border: `0.5px solid ${LINE}` }}>
        <GridFloor />
        <AvatarFigure />
        <DrapedGarment />
        <StressPoint x={108} y={178} tone={CLAY} label="Pull" />
        <StressPoint x={232} y={212} tone={AMBER} label="Ease" />
        <StressPoint x={178} y={318} tone={CYAN} label="Flow" />
      </div>

      <div className="absolute inset-x-5 bottom-5 grid grid-cols-3 gap-2">
        <Metric label="Collision" value="2mm" tone={CYAN} />
        <Metric label="Stretch" value="11%" tone={AMBER} />
        <Metric label="Drape" value="Soft" tone={CLAY} />
      </div>
    </div>
  );
}

function MaterialPhysics() {
  return (
    <div className="relative h-full w-full" style={{ background: PAPER, color: INK }}>
      <Header eyebrow="Fabric behavior" title="Silk bias skirt" />

      <div className="mx-5 mt-5 rounded-[20px] p-4" style={{ background: PANEL, border: `0.5px solid ${LINE}` }}>
        <div className="relative h-[220px] overflow-hidden rounded-[16px]" style={{ background: "#eff1ee" }}>
          <GridFloor compact />
          <FabricSwatch />
          <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2">
            <MiniStat label="GSM" value="88" />
            <MiniStat label="Shear" value="Low" />
            <MiniStat label="Bend" value="0.36" />
          </div>
        </div>
      </div>

      <div className="mx-5 mt-4 grid gap-3">
        <PhysicsRow icon={<Wind size={18} />} label="Drape weight" value="Light" amount="34%" color={CYAN} />
        <PhysicsRow icon={<Activity size={18} />} label="Stretch recovery" value="Medium" amount="58%" color={AMBER} />
        <PhysicsRow icon={<Droplets size={18} />} label="Rain response" value="Poor" amount="18%" color={CLAY} />
        <PhysicsRow icon={<Layers3 size={18} />} label="Layer friction" value="Smooth" amount="27%" color={GRAPHITE} />
      </div>

      <div className="absolute bottom-5 left-5 right-5 rounded-[16px] p-4" style={{ background: GRAPHITE, color: PAPER }}>
        <p className="text-[11px] font-semibold uppercase" style={{ color: "rgba(247,247,242,0.62)", letterSpacing: 0 }}>
          Rule engine note
        </p>
        <p className="mt-2 text-[13px] leading-5">
          Lightweight silk works for indoor dinner styling, but needs a structured coat when wind is above 18 km/h.
        </p>
      </div>
    </div>
  );
}

function FitReview() {
  return (
    <div className="relative h-full w-full" style={{ background: PAPER, color: INK }}>
      <Header eyebrow="Avatar fitting" title="Resolve fit risks" />

      <div className="mx-5 mt-5 grid grid-cols-[1fr_78px] gap-3">
        <div className="relative h-[360px] overflow-hidden rounded-[20px]" style={{ background: "#e6e8e6", border: `0.5px solid ${LINE}` }}>
          <GridFloor />
          <AvatarFigure slim />
          <FitOverlay />
        </div>
        <div className="grid gap-2">
          <FitChip label="Bust" value="+1.8" tone={CYAN} />
          <FitChip label="Waist" value="-0.4" tone={GRAPHITE} />
          <FitChip label="Hip" value="+3.2" tone={CLAY} />
          <FitChip label="Hem" value="+2.1" tone={AMBER} />
        </div>
      </div>

      <div className="mx-5 mt-4 rounded-[16px] p-4" style={{ background: PANEL, border: `0.5px solid ${LINE}` }}>
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-semibold uppercase" style={{ color: MUTED, letterSpacing: 0 }}>
            Suggested adjustment
          </p>
          <span className="text-[12px] font-semibold" style={{ color: CLAY }}>
            High impact
          </span>
        </div>
        <p className="mt-2 text-[18px] font-semibold leading-6" style={{ letterSpacing: 0 }}>
          Add 2 cm ease through hip and lower sleeve stiffness.
        </p>
      </div>

      <div className="absolute bottom-5 left-5 right-5 grid grid-cols-[1fr_52px] gap-2">
        <button className="h-12 rounded-[10px] text-[14px] font-semibold" style={{ background: GRAPHITE, color: PAPER }}>
          Apply to outfit
        </button>
        <button aria-label="Open layer stack" title="Open layer stack" className="flex h-12 items-center justify-center rounded-[10px]" style={{ background: PANEL, border: `0.5px solid ${LINE}` }}>
          <Layers3 size={19} />
        </button>
      </div>
    </div>
  );
}

function GridFloor({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className="absolute inset-0 opacity-70"
      style={{
        backgroundImage:
          "linear-gradient(rgba(17,19,21,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(17,19,21,0.08) 1px, transparent 1px)",
        backgroundSize: compact ? "22px 22px" : "28px 28px"
      }}
    />
  );
}

function AvatarFigure({ slim = false }: { slim?: boolean }) {
  return (
    <div className="absolute left-1/2 top-12 h-[320px] w-[112px] -translate-x-1/2">
      <div className="absolute left-1/2 top-0 h-10 w-10 -translate-x-1/2 rounded-full" style={{ background: "#c8afa0" }} />
      <div
        className="absolute left-1/2 top-[39px] h-[186px] -translate-x-1/2 rounded-t-[48px] rounded-b-[30px]"
        style={{ width: slim ? 74 : 86, background: "rgba(35,40,45,0.16)" }}
      />
      <div className="absolute left-[16px] top-[98px] h-[155px] w-4 rotate-[8deg] rounded-full" style={{ background: "rgba(35,40,45,0.14)" }} />
      <div className="absolute right-[16px] top-[98px] h-[155px] w-4 rotate-[-8deg] rounded-full" style={{ background: "rgba(35,40,45,0.14)" }} />
      <div className="absolute left-[35px] top-[232px] h-[108px] w-5 rounded-full" style={{ background: "rgba(35,40,45,0.14)" }} />
      <div className="absolute right-[35px] top-[232px] h-[108px] w-5 rounded-full" style={{ background: "rgba(35,40,45,0.14)" }} />
    </div>
  );
}

function DrapedGarment() {
  return (
    <div className="absolute left-1/2 top-[118px] h-[245px] w-[158px] -translate-x-1/2">
      <div
        className="absolute inset-x-[25px] top-0 h-[86px] rounded-t-[40px]"
        style={{ background: "#faf6ec", border: "0.5px solid rgba(17,19,21,0.18)" }}
      />
      <div
        className="absolute left-0 right-0 top-[58px] h-[172px]"
        style={{
          background:
            "repeating-linear-gradient(96deg, rgba(42,183,198,0.2) 0 1px, transparent 1px 14px), #f4ead8",
          clipPath: "polygon(28% 0, 72% 0, 100% 100%, 0 100%)",
          border: "0.5px solid rgba(17,19,21,0.18)"
        }}
      />
      <div className="absolute left-[49px] top-3 h-[212px] w-px" style={{ background: "rgba(17,19,21,0.16)" }} />
      <div className="absolute right-[49px] top-3 h-[212px] w-px" style={{ background: "rgba(17,19,21,0.16)" }} />
    </div>
  );
}

function FabricSwatch() {
  return (
    <div className="absolute left-1/2 top-8 h-[136px] w-[210px] -translate-x-1/2">
      <div
        className="absolute inset-0 rounded-[22px]"
        style={{
          background:
            "repeating-linear-gradient(105deg, rgba(184,95,66,0.24) 0 1px, transparent 1px 13px), linear-gradient(135deg, #fff9ed, #eadbc0)",
          boxShadow: "0 24px 40px rgba(17,19,21,0.15)",
          transform: "skewY(-5deg) rotate(-4deg)"
        }}
      />
      <div className="absolute left-8 top-0 h-[136px] w-px rotate-[8deg]" style={{ background: "rgba(17,19,21,0.16)" }} />
      <div className="absolute left-20 top-0 h-[136px] w-px rotate-[4deg]" style={{ background: "rgba(17,19,21,0.12)" }} />
      <div className="absolute right-16 top-0 h-[136px] w-px rotate-[-3deg]" style={{ background: "rgba(17,19,21,0.12)" }} />
    </div>
  );
}

function FitOverlay() {
  return (
    <div className="absolute left-1/2 top-[115px] h-[250px] w-[148px] -translate-x-1/2">
      <div className="absolute left-6 right-6 top-0 h-[90px] rounded-t-[38px]" style={{ background: "rgba(42,183,198,0.24)", border: `1px solid ${CYAN}` }} />
      <div className="absolute left-0 right-0 top-[66px] h-[158px]" style={{ background: "rgba(184,95,66,0.18)", clipPath: "polygon(30% 0, 70% 0, 100% 100%, 0 100%)", border: `1px solid ${CLAY}` }} />
      <div className="absolute left-[14px] right-[14px] top-[122px] h-px" style={{ background: CLAY }} />
      <div className="absolute left-[28px] right-[28px] top-[178px] h-px" style={{ background: AMBER }} />
    </div>
  );
}

function StressPoint({ x, y, tone, label }: { x: number; y: number; tone: string; label: string }) {
  return (
    <div className="absolute flex items-center gap-1.5" style={{ left: x, top: y }}>
      <span className="h-3 w-3 rounded-full" style={{ background: tone, boxShadow: `0 0 0 5px ${tone}22` }} />
      <span className="rounded-[6px] px-1.5 py-1 text-[10px] font-semibold" style={{ background: PANEL, color: INK }}>
        {label}
      </span>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-[12px] p-3" style={{ background: PANEL, border: `0.5px solid ${LINE}` }}>
      <p className="text-[10px] font-semibold uppercase" style={{ color: MUTED, letterSpacing: 0 }}>
        {label}
      </p>
      <p className="mt-1 text-[18px] font-semibold" style={{ color: tone, letterSpacing: 0 }}>
        {value}
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] p-2" style={{ background: "rgba(255,255,255,0.82)", border: `0.5px solid ${LINE}` }}>
      <p className="text-[9px] font-semibold uppercase" style={{ color: MUTED, letterSpacing: 0 }}>
        {label}
      </p>
      <p className="text-[13px] font-semibold" style={{ letterSpacing: 0 }}>
        {value}
      </p>
    </div>
  );
}

function PhysicsRow({
  icon,
  label,
  value,
  amount,
  color
}: {
  icon: ReactNode;
  label: string;
  value: string;
  amount: string;
  color: string;
}) {
  return (
    <div className="rounded-[14px] p-3" style={{ background: PANEL, border: `0.5px solid ${LINE}` }}>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-[8px]" style={{ background: `${color}1f`, color }}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-[13px] font-semibold" style={{ letterSpacing: 0 }}>
              {label}
            </p>
            <span className="text-[12px] font-semibold" style={{ color }}>
              {value}
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full" style={{ background: "rgba(17,19,21,0.08)" }}>
            <div className="h-full rounded-full" style={{ width: amount, background: color }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FitChip({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-[12px] p-2.5" style={{ background: PANEL, border: `0.5px solid ${LINE}` }}>
      <p className="text-[9px] font-semibold uppercase" style={{ color: MUTED, letterSpacing: 0 }}>
        {label}
      </p>
      <p className="mt-1 text-[15px] font-semibold" style={{ color: tone, letterSpacing: 0 }}>
        {value}
      </p>
    </div>
  );
}
