// Shared shape for the drill-down detail, built by the dashboard and rendered by
// DetailSheet. Kept separate to avoid client/server import tangles.

import type { ValueFormat } from "@/lib/pulse-config";
import type { BreakdownItem, Factor, SeriesPoint } from "@/lib/pulse-types";

export type RangeKey = "week" | "month" | "year" | "max";

export const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: "week", label: "Week", days: 7 },
  { key: "month", label: "Month", days: 30 },
  { key: "year", label: "Year", days: 365 },
  { key: "max", label: "Max", days: Number.POSITIVE_INFINITY },
];

export interface DetailBreakdown {
  title: string;
  variant: "factors" | "items";
  factors?: Factor[];
  items?: BreakdownItem[];
}

export interface DetailView {
  where: string;
  title: string;
  unit: string;
  fmt: ValueFormat;
  /** Full day-grain history (oldest→newest); values may be null gaps. */
  series: SeriesPoint[];
  band?: [number, number];
  breakdown?: DetailBreakdown;
}
