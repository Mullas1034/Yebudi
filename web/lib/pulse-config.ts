// Shared, client-safe config + formatting for the Pulse dashboard tiles. Used by the
// dashboard grid, the sparklines, and the drill-down detail.

import type { DailySummaryView } from "@/lib/pulse-types";

export type ValueFormat = "int" | "duration";

export type BreakdownKind =
  | "sleepStages"
  | "hrvStatus"
  | "stressBuckets"
  | "bodyBattery"
  | "sleepContributors"
  | "none";

export interface TileDef {
  id: string;
  label: string;
  unit: string;
  /** Column of DailySummaryView that holds this metric's daily value. */
  key: keyof DailySummaryView;
  fmt: ValueFormat;
  /** Drill-down breakdown to render under the chart. */
  breakdown: BreakdownKind;
  /** Lower-is-better metrics invert the trend tone (e.g. resting HR, stress). */
  lowerIsBetter?: boolean;
}

export const PULSE_TILES: TileDef[] = [
  { id: "sleep", label: "Sleep", unit: "", key: "sleepDurationS", fmt: "duration", breakdown: "sleepStages" },
  { id: "hrv", label: "HRV", unit: "ms", key: "hrvLastNightMs", fmt: "int", breakdown: "hrvStatus" },
  { id: "stress", label: "Stress", unit: "avg", key: "stressAvg", fmt: "int", breakdown: "stressBuckets", lowerIsBetter: true },
  { id: "rhr", label: "Resting HR", unit: "bpm", key: "restingHr", fmt: "int", breakdown: "none", lowerIsBetter: true },
  { id: "battery", label: "Body Battery", unit: "%", key: "bodyBatteryMorning", fmt: "int", breakdown: "bodyBattery" },
  { id: "sleepscore", label: "Sleep score", unit: "/100", key: "sleepScore", fmt: "int", breakdown: "sleepContributors" },
];

export function tileById(id: string): TileDef | undefined {
  return PULSE_TILES.find((t) => t.id === id);
}

export function formatValue(value: number | null, fmt: ValueFormat): string {
  if (value == null) return "—";
  if (fmt === "duration") {
    const h = Math.floor(value / 3600);
    const m = Math.round((value % 3600) / 60);
    return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
  }
  return String(Math.round(value));
}

/** Numeric series for a tile across a day-grain history window (oldest→newest). */
export function seriesFor(history: DailySummaryView[], def: TileDef): (number | null)[] {
  return history.map((d) => {
    const v = d[def.key];
    return typeof v === "number" ? v : null;
  });
}

export type Trend = "pos" | "neg" | "neu";

/** Day-over-day delta tone, respecting lower-is-better metrics. */
export function deltaTone(values: (number | null)[], lowerIsBetter = false): { tone: Trend; text: string } {
  const clean = values.filter((v): v is number => v != null);
  if (clean.length < 2) return { tone: "neu", text: "—" };
  const last = clean[clean.length - 1];
  const prev = clean[clean.length - 2];
  const diff = last - prev;
  if (diff === 0) return { tone: "neu", text: "0" };
  const improved = lowerIsBetter ? diff < 0 : diff > 0;
  const sign = diff > 0 ? "+" : "";
  return { tone: improved ? "pos" : "neg", text: `${sign}${Math.round(diff * 10) / 10}` };
}
