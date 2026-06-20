import type { MorningReadiness } from "@/lib/types";

// Stand-in for a query against curated.daily_summary (+ a join to sleep_session
// and a 7-day HRV history). Swap getMorningReadiness() for a real DB call later.
export function getMorningReadiness(): MorningReadiness {
  return {
    day: "2026-06-20",
    readinessScore: 82,
    readinessStatus: "primed",
    hrvStatus: "balanced",
    hrvLastNightMs: 68,
    hrvWeeklyAvgMs: 64,
    hrvBaselineLowMs: 52,
    hrvBaselineHighMs: 78,
    bodyBatteryHigh: 94,
    bodyBatteryLow: 18,
    bodyBatteryMorning: 88,
    sleepScore: 79,
    sleepDurationS: 26280, // 7h 18m asleep
    restingHr: 48,
    stressAvg: 28,
    trainingLoadAcute: 420,
    trainingLoadChronic: 480,
    trainingReadiness: 80,
    computedAt: "2026-06-20T06:12:00Z",
    sleep: {
      deepS: 5400, // 1h 30m
      lightS: 14400, // 4h 00m
      remS: 6480, // 1h 48m
      awakeS: 900, // 15m
      avgHrvMs: 66,
      avgSpo2: 96,
      restingHr: 48,
    },
    hrvTrend7d: [58, 61, 60, 64, 62, 67, 68],
  };
}
