interface TrendSparklineProps {
  values: number[];
  status?: string | null;
}

export function TrendSparkline({ values, status }: TrendSparklineProps) {
  if (values.length < 2) {
    return (
      <div className="flex h-14 items-center justify-center rounded-[8px] border border-current/10 bg-white/40 text-[11px] opacity-65">
        30-day data pending
      </div>
    );
  }

  const width = 180;
  const height = 56;
  const padding = 6;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (width - padding * 2) / Math.max(values.length - 1, 1);

  const points = values
    .map((value, index) => {
      const x = padding + index * step;
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const stroke = resolveStroke(status);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full overflow-visible rounded-[8px] border border-current/10 bg-white/40 p-1">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function resolveStroke(status?: string | null) {
  switch (status) {
    case "rising":
    case "dominant":
      return "#0DFFE8";
    case "cooling":
      return "#FF6B9D";
    case "candidate":
    case "emerging":
    case "confirmed":
    case "flat":
    default:
      return "#7B5CF0";
  }
}
