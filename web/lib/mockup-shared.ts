// Shared helpers for mapping real query data into the mockup's metric shapes.

export type Tone = "pos" | "neg" | "neu";

export interface MSeries {
  v: number;
  date: string;
}

/** A single real point can't draw a line; flatten to a 2-point flat line (honest). */
export function flat(s: MSeries[]): MSeries[] {
  return s.length === 1 ? [s[0], s[0]] : s;
}

/** Sparkline values (last 7) — null when there isn't enough to draw. */
export function spark(values: number[]): number[] | null {
  return values.length >= 2 ? values.slice(-7) : null;
}

export function band(values: number[], fallback: [number, number]): [number, number] {
  if (values.length === 0) return fallback;
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    lo -= Math.max(1, Math.abs(lo) * 0.05);
    hi += Math.max(1, Math.abs(hi) * 0.05);
  }
  return [lo, hi];
}

export function deltaInt(values: number[], lowerIsBetter = false): { delta: string; tone: Tone } {
  if (values.length < 2) return { delta: "—", tone: "neu" };
  const diff = values[values.length - 1] - values[values.length - 2];
  if (diff === 0) return { delta: "0", tone: "neu" };
  const improved = lowerIsBetter ? diff < 0 : diff > 0;
  return { delta: `${diff > 0 ? "+" : ""}${Math.round(diff * 10) / 10}`, tone: improved ? "pos" : "neg" };
}

export function thousands(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function readinessMeta(score: number | null): { status: string; state: string } {
  if (score == null) return { status: "No reading", state: "caution" };
  if (score >= 80) return { status: "Primed", state: "good" };
  if (score >= 60) return { status: "Ready", state: "good" };
  if (score >= 40) return { status: "Moderate", state: "caution" };
  return { status: "Take it easy", state: "bad" };
}

export function weekdayNarrow(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "narrow" });
}
