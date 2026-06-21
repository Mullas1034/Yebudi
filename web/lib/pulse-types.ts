// View-model shapes for the Pulse (Pillar 1 — Daily readiness) dashboard. The query
// layer (lib/db/queries/pulse.ts) maps curated rows + parsed raw payloads into these.

export type FactorState = "good" | "caution" | "bad";

/** One row of curated.daily_summary, camelCased, plus the day. */
export interface DailySummaryView {
  day: string;
  readinessScore: number | null;
  readinessStatus: string | null;
  hrvStatus: string | null;
  hrvLastNightMs: number | null;
  hrvWeeklyAvgMs: number | null;
  hrvBaselineLowMs: number | null;
  hrvBaselineHighMs: number | null;
  bodyBatteryHigh: number | null;
  bodyBatteryLow: number | null;
  bodyBatteryMorning: number | null;
  sleepScore: number | null;
  sleepDurationS: number | null;
  restingHr: number | null;
  stressAvg: number | null;
  trainingLoadAcute: number | null;
  trainingLoadChronic: number | null;
  trainingReadiness: number | null;
}

export interface SleepView {
  deepS: number | null;
  lightS: number | null;
  remS: number | null;
  awakeS: number | null;
  avgHrvMs: number | null;
  avgSpo2: number | null;
  avgRespiration: number | null;
  restingHr: number | null;
}

/** A single point in a per-metric history series. */
export interface SeriesPoint {
  date: string; // 'YYYY-MM-DD'
  value: number | null;
}

/** "What drove it" readiness contributing factor (from raw training_readiness). */
export interface Factor {
  name: string;
  value: string; // feedback / descriptor text
  pct: number; // 0..100 contribution bar
  state: FactorState;
}

/** A labelled segment in a tile's drill-down breakdown (stress buckets, BB, etc.). */
export interface BreakdownItem {
  label: string;
  value: string;
  pct: number; // 0..100 relative bar
  color?: string;
}

export interface HrvStatusCount {
  status: string;
  days: number;
}

/** Everything the Pulse dashboard needs for one day, assembled server-side. */
export interface PulseData {
  day: string;
  summary: DailySummaryView | null;
  sleep: SleepView | null;
  /** Day-grain history (oldest→newest) for sparklines + drill-down charts. */
  history: DailySummaryView[];
  factors: Factor[];
  stressBuckets: BreakdownItem[];
  sleepContributors: BreakdownItem[];
  hrvStatusCounts: HrvStatusCount[];
  bodyBattery: { charged: number | null; drained: number | null };
}
