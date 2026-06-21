import "server-only";

import { getDb } from "@/lib/db/client";
import type { DailySummaryTable } from "@/lib/db/schema";
import type {
  BreakdownItem,
  DailySummaryView,
  Factor,
  FactorState,
  HrvStatusCount,
  PulseData,
  SleepView,
} from "@/lib/pulse-types";

// ── small helpers ────────────────────────────────────────────────────────────

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function stateForPct(pct: number): FactorState {
  return pct >= 80 ? "good" : pct >= 60 ? "caution" : "bad";
}

function humanize(s: unknown): string {
  if (typeof s !== "string" || !s) return "";
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtHm(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── row → view mapping ───────────────────────────────────────────────────────

function toView(r: DailySummaryTable): DailySummaryView {
  return {
    day: r.day,
    readinessScore: r.readiness_score,
    readinessStatus: r.readiness_status,
    hrvStatus: r.hrv_status,
    hrvLastNightMs: r.hrv_last_night_ms,
    hrvWeeklyAvgMs: r.hrv_weekly_avg_ms,
    hrvBaselineLowMs: r.hrv_baseline_low_ms,
    hrvBaselineHighMs: r.hrv_baseline_high_ms,
    bodyBatteryHigh: r.body_battery_high,
    bodyBatteryLow: r.body_battery_low,
    bodyBatteryMorning: r.body_battery_morning,
    sleepScore: r.sleep_score,
    sleepDurationS: r.sleep_duration_s,
    restingHr: r.resting_hr,
    stressAvg: r.stress_avg,
    trainingLoadAcute: r.training_load_acute,
    trainingLoadChronic: r.training_load_chronic,
    trainingReadiness: r.training_readiness,
  };
}

// ── raw payload parsers (best-effort, degrade to empty) ───────────────────────

/** Garmin training-readiness factors. Field names per Connect's readiness API; any
 *  missing factor is simply skipped so the UI shows only what's present. */
function parseFactors(payload: unknown): Factor[] {
  const item = Array.isArray(payload) ? asRecord(payload[0]) : asRecord(payload);
  if (!item) return [];
  const defs: { name: string; pctKey: string; fbKey: string }[] = [
    { name: "Sleep", pctKey: "sleepScoreFactorPercent", fbKey: "sleepScoreFactorFeedback" },
    { name: "Recovery time", pctKey: "recoveryTimeFactorPercent", fbKey: "recoveryTimeFactorFeedback" },
    { name: "HRV", pctKey: "hrvFactorPercent", fbKey: "hrvFactorFeedback" },
    { name: "Acute load", pctKey: "acwrFactorPercent", fbKey: "acwrFactorFeedback" },
    { name: "Stress history", pctKey: "stressHistoryFactorPercent", fbKey: "stressHistoryFactorFeedback" },
    { name: "Sleep history", pctKey: "sleepHistoryFactorPercent", fbKey: "sleepHistoryFactorFeedback" },
  ];
  const out: Factor[] = [];
  for (const d of defs) {
    const pct = num(item[d.pctKey]);
    if (pct == null) continue;
    const clamped = Math.max(0, Math.min(100, pct));
    const fb = humanize(item[d.fbKey]);
    out.push({
      name: d.name,
      value: fb ? `${clamped}% · ${fb}` : `${clamped}%`,
      pct: clamped,
      state: stateForPct(clamped),
    });
  }
  return out;
}

/** All-day stress time buckets (seconds → labelled hours). */
function parseStressBuckets(payload: unknown): BreakdownItem[] {
  const p = asRecord(payload);
  if (!p) return [];
  const defs: { label: string; key: string; color: string }[] = [
    { label: "Rest", key: "restStressDuration", color: "#2D9CDB" },
    { label: "Low", key: "lowStressDuration", color: "var(--good)" },
    { label: "Medium", key: "mediumStressDuration", color: "var(--caution)" },
    { label: "High", key: "highStressDuration", color: "var(--bad)" },
  ];
  const secs = defs.map((d) => ({ ...d, s: num(p[d.key]) ?? 0 }));
  const total = secs.reduce((a, b) => a + b.s, 0);
  if (total <= 0) return [];
  return secs.map((d) => ({
    label: d.label,
    value: fmtHm(d.s),
    pct: (d.s / total) * 100,
    color: d.color,
  }));
}

/** Body Battery charged / drained for the day. */
function parseBodyBattery(payload: unknown): { charged: number | null; drained: number | null } {
  const item = Array.isArray(payload) ? asRecord(payload[0]) : asRecord(payload);
  if (!item) return { charged: null, drained: null };
  return { charged: num(item.charged), drained: num(item.drained) };
}

/** Sleep-score contributor sub-scores (dailySleepDTO.sleepScores). */
function parseSleepContributors(payload: unknown): BreakdownItem[] {
  const dto = asRecord(asRecord(payload)?.dailySleepDTO);
  const scores = asRecord(dto?.sleepScores);
  if (!scores) return [];
  const defs: { label: string; key: string }[] = [
    { label: "Duration", key: "totalDuration" },
    { label: "Deep sleep", key: "deepPercentage" },
    { label: "REM", key: "remPercentage" },
    { label: "Restfulness", key: "restlessness" },
  ];
  const out: BreakdownItem[] = [];
  for (const d of defs) {
    const sub = asRecord(scores[d.key]);
    const value = num(sub?.value);
    if (value == null) continue;
    const pct = Math.max(0, Math.min(100, value));
    const qualifier = humanize(sub?.qualifierKey);
    out.push({ label: d.label, value: qualifier || String(Math.round(value)), pct });
  }
  return out;
}

function hrvStatusCounts(history: DailySummaryView[]): HrvStatusCount[] {
  const last7 = history.slice(-7);
  const counts = new Map<string, number>();
  for (const d of last7) {
    if (!d.hrvStatus) continue;
    counts.set(d.hrvStatus, (counts.get(d.hrvStatus) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([status, days]) => ({ status, days }))
    .sort((a, b) => b.days - a.days);
}

// ── main entry ───────────────────────────────────────────────────────────────

const RAW_ENDPOINTS = ["training_readiness", "stress", "body_battery", "sleep"] as const;

async function latestRaw(day: string, endpoint: string): Promise<unknown> {
  const row = await getDb()
    .withSchema("raw")
    .selectFrom("garmin_response")
    .select("payload")
    .where("target_date", "=", day)
    .where("endpoint", "=", endpoint)
    .orderBy("fetched_at", "desc")
    .limit(1)
    .executeTakeFirst();
  return row?.payload ?? null;
}

/**
 * Assemble the Pulse view model for a given day. When `day` is omitted, uses the most
 * recent day present in curated.daily_summary so the dashboard always shows real data.
 */
export async function getPulse(day?: string): Promise<PulseData> {
  const curated = getDb().withSchema("curated");

  const targetDay =
    day ??
    (
      await curated
        .selectFrom("daily_summary")
        .select("day")
        .orderBy("day", "desc")
        .limit(1)
        .executeTakeFirst()
    )?.day;

  // No data at all yet.
  if (!targetDay) {
    return {
      day: new Date().toISOString().slice(0, 10),
      summary: null,
      sleep: null,
      history: [],
      factors: [],
      stressBuckets: [],
      sleepContributors: [],
      hrvStatusCounts: [],
      bodyBattery: { charged: null, drained: null },
    };
  }

  const [summaryRow, sleepRow, historyRows, ...rawPayloads] = await Promise.all([
    curated.selectFrom("daily_summary").selectAll().where("day", "=", targetDay).executeTakeFirst(),
    curated.selectFrom("sleep_session").selectAll().where("day", "=", targetDay).executeTakeFirst(),
    curated
      .selectFrom("daily_summary")
      .selectAll()
      .where("day", "<=", targetDay)
      .orderBy("day", "desc")
      .limit(400)
      .execute(),
    ...RAW_ENDPOINTS.map((e) => latestRaw(targetDay, e)),
  ]);

  const history = historyRows.map(toView).reverse(); // oldest → newest

  const sleep: SleepView | null = sleepRow
    ? {
        deepS: sleepRow.deep_s,
        lightS: sleepRow.light_s,
        remS: sleepRow.rem_s,
        awakeS: sleepRow.awake_s,
        avgHrvMs: sleepRow.avg_hrv_ms,
        avgSpo2: sleepRow.avg_spo2,
        avgRespiration: sleepRow.avg_respiration,
        restingHr: sleepRow.resting_hr,
      }
    : null;

  const [readinessRaw, stressRaw, bodyBatteryRaw, sleepRaw] = rawPayloads;

  return {
    day: targetDay,
    summary: summaryRow ? toView(summaryRow) : null,
    sleep,
    history,
    factors: parseFactors(readinessRaw),
    stressBuckets: parseStressBuckets(stressRaw),
    sleepContributors: parseSleepContributors(sleepRaw),
    hrvStatusCounts: hrvStatusCounts(history),
    bodyBattery: parseBodyBattery(bodyBatteryRaw),
  };
}
