// Ported from the mockup's sparkSVG. Accepts a series that may contain null gaps;
// renders the line through the present points only.

export function Sparkline({
  values,
  width = 120,
  height = 30,
  dot = true,
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
  dot?: boolean;
}) {
  const present = values
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v != null);
  if (present.length < 2) return <svg width="100%" height={height} aria-hidden />;

  const nums = present.map((p) => p.v);
  const mn = Math.min(...nums);
  const mx = Math.max(...nums);
  const rng = mx - mn || 1;
  const pad = 3;
  const n = values.length;
  const X = (i: number) => pad + (i / (n - 1)) * (width - 2 * pad);
  const Y = (v: number) => pad + (1 - (v - mn) / rng) * (height - 2 * pad);

  const line = present.map((p) => `${X(p.i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
  const last = present[present.length - 1];
  const gid = `sg-${Math.round(X(last.i))}-${nums.length}`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity={0.26} />
          <stop offset="1" stopColor="var(--accent)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`${pad},${height - pad} ${line} ${width - pad},${height - pad}`} fill={`url(#${gid})`} />
      <polyline
        points={line}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {dot && <circle cx={X(last.i).toFixed(1)} cy={Y(last.v).toFixed(1)} r={2.6} fill="var(--accent)" />}
    </svg>
  );
}
