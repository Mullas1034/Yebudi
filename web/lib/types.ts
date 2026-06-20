// Frontend types mirroring the curated schema. Column names are mapped to camelCase
// at the data-access boundary (a thin query layer to be added later — Kysely/Drizzle).

export type HrvStatus = "balanced" | "unbalanced" | "low" | "poor" | "no_reading";

/** Mirrors curated.daily_summary. */
export interface DailySummary {
  day: string; // ISO date (YYYY-MM-DD)
  readinessScore: number | null;
  readinessStatus: string | null;
  hrvStatus: HrvStatus | null;
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
  computedAt: string; // ISO timestamp
}

/** Drill-down detail, joined from curated.sleep_session. */
export interface SleepBreakdown {
  deepS: number;
  lightS: number;
  remS: number;
  awakeS: number;
  avgHrvMs: number | null;
  avgSpo2: number | null;
  restingHr: number | null;
}

/** The view model the Morning Readiness dashboard renders. */
export interface MorningReadiness extends DailySummary {
  sleep: SleepBreakdown | null;
  /** Last 7 nights of HRV (from daily_summary history) for the sparkline. */
  hrvTrend7d: number[];
}
