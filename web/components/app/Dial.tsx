import type { FactorState } from "@/lib/pulse-types";

// Ported from the mockup's dialSVG/dialBlock — a 270° gauge with tick marks.

function DialSVG({ value, size }: { value: number; size: number }) {
  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const sweep = 0.75;
  const start = 135;
  const prog = (Math.max(0, Math.min(100, value)) / 100) * sweep * C;

  const ticks = [];
  const n = 37;
  for (let i = 0; i < n; i++) {
    const a = ((start + (i / (n - 1)) * 270) * Math.PI) / 180;
    const major = i % 6 === 0;
    const r1 = r + 8;
    const r2 = r + (major ? 2 : 5);
    ticks.push(
      <line
        key={i}
        x1={cx + r1 * Math.cos(a)}
        y1={cy + r1 * Math.sin(a)}
        x2={cx + r2 * Math.cos(a)}
        y2={cy + r2 * Math.sin(a)}
        stroke="var(--tick)"
        strokeWidth={major ? 2 : 1}
        opacity={major ? 1 : 0.65}
      />,
    );
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(135 ${cx} ${cy})`}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--track)"
          strokeWidth={9}
          strokeDasharray={`${sweep * C} ${C}`}
          strokeLinecap="round"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={9}
          strokeDasharray={`${prog} ${C}`}
          strokeLinecap="round"
        />
      </g>
      {ticks}
    </svg>
  );
}

export function Dial({
  value,
  label,
  status,
  state = "good",
  sub,
  size = 210,
}: {
  value: number | null;
  label: string;
  status: string;
  state?: FactorState;
  sub?: string;
  size?: number;
}) {
  return (
    <div className="dialwrap">
      <div className="dial" style={{ width: size, height: size }}>
        <DialSVG value={value ?? 0} size={size} />
        <div className="center">
          <div className="big" style={{ fontSize: size * 0.34 }}>
            {value ?? "—"}
          </div>
          <div className="lbl">{label}</div>
        </div>
      </div>
      <div className={`pill s-${state}`}>
        <span className="dot" />
        {status}
      </div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
