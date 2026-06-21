// Maps the real PulseData (from getPulse) into the exact object shapes the mockup's
// rendering engine expects: MODES.pulse and HERO_FACTORS.pulse. Only the data differs
// from the mockup — the visuals are produced by the mockup's own code.

import type { BreakdownItem, DailySummaryView, PulseData } from "@/lib/pulse-types";

type Tone = "pos" | "neg" | "neu";

interface SeriesPt {
  v: number;
  date: string;
}

interface MockupMetric {
  id: string;
  label: string;
  value: string;
  unit: string;
  delta: string;
  tone: Tone;
  fmt: "int" | "time";
  base: number;
  vol: number;
  band: [number, number];
  series?: SeriesPt[];
  spark?: number[] | null;
  bd?: { title: string; items: { label: string; val: string; pct: number; color?: string }[] };
}

export interface PulseMockup {
  pulse: {
    name: string;
    where: string;
    date: string;
    trendKey: string;
    empty?: string;
    hero: { type: "dial"; value: number; label: string; status: string; state: string; sub: string };
    metrics: MockupMetric[];
    trend?: { type: "line"; title: string; unit: string };
  };
  heroFactors: {
    base: number;
    band: [number, number];
    series?: SeriesPt[];
    factors: { name: string; val: string; pct: number; state: string }[];
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function fmtHm(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function readinessMeta(score: number | null): { status: string; state: string } {
  if (score == null) return { status: "No reading", state: "caution" };
  if (score >= 80) return { status: "Primed", state: "good" };
  if (score >= 60) return { status: "Ready", state: "good" };
  if (score >= 40) return { status: "Moderate", state: "caution" };
  return { status: "Take it easy", state: "bad" };
}

/** Real {v,date} series for a metric, with single-point flattened to a flat line. */
function buildSeries(history: DailySummaryView[], pick: (d: DailySummaryView) => number | null): SeriesPt[] {
  const pts = history
    .map((d) => ({ v: pick(d), date: d.day }))
    .filter((p): p is SeriesPt => p.v != null);
  if (pts.length === 1) return [pts[0], pts[0]]; // honest flat line for a single day
  return pts;
}

function band(values: number[], fallback: [number, number]): [number, number] {
  if (values.length === 0) return fallback;
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    lo -= Math.max(1, Math.abs(lo) * 0.05);
    hi += Math.max(1, Math.abs(hi) * 0.05);
  }
  return [lo, hi];
}

function deltaInt(values: number[], lowerIsBetter = false): { delta: string; tone: Tone } {
  if (values.length < 2) return { delta: "—", tone: "neu" };
  const diff = values[values.length - 1] - values[values.length - 2];
  if (diff === 0) return { delta: "0", tone: "neu" };
  const improved = lowerIsBetter ? diff < 0 : diff > 0;
  return { delta: `${diff > 0 ? "+" : ""}${Math.round(diff)}`, tone: improved ? "pos" : "neg" };
}

function mapItems(items: BreakdownItem[]): { label: string; val: string; pct: number; color?: string }[] {
  return items.map((i) => ({ label: i.label, val: i.value, pct: i.pct, color: i.color }));
}

const STAGE_COLORS: Record<string, string> = {
  Deep: "#2D7DF6",
  Light: "#7FB2FF",
  REM: "#A78BFA",
  Awake: "#C9D1DC",
};

// ── main ─────────────────────────────────────────────────────────────────────

export function toMockupPulse(p: PulseData): PulseMockup {
  const s = p.summary;
  const h = p.history;
  const latest = <T,>(arr: T[]): T | undefined => (arr.length ? arr[arr.length - 1] : undefined);

  // Sleep (hours)
  const sleepSeries = buildSeries(h, (d) => (d.sleepDurationS != null ? d.sleepDurationS / 3600 : null));
  const sleepVals = sleepSeries.map((x) => x.v);
  const sleepLatest = latest(sleepVals);
  const sleepDelta =
    sleepVals.length < 2
      ? { delta: "—", tone: "neu" as Tone }
      : (() => {
          const m = Math.round((sleepVals[sleepVals.length - 1] - sleepVals[sleepVals.length - 2]) * 60);
          return { delta: m === 0 ? "0" : `${m > 0 ? "+" : ""}${m}m`, tone: (m >= 0 ? "pos" : "neg") as Tone };
        })();

  // HRV
  const hrvSeries = buildSeries(h, (d) => d.hrvLastNightMs);
  const hrvVals = hrvSeries.map((x) => x.v);

  // Stress (lower better)
  const stressSeries = buildSeries(h, (d) => d.stressAvg);
  const stressVals = stressSeries.map((x) => x.v);

  // Resting HR (lower better)
  const rhrSeries = buildSeries(h, (d) => d.restingHr);
  const rhrVals = rhrSeries.map((x) => x.v);

  // Body Battery
  const bbSeries = buildSeries(h, (d) => d.bodyBatteryMorning);
  const bbVals = bbSeries.map((x) => x.v);

  // Sleep score
  const ssSeries = buildSeries(h, (d) => d.sleepScore);
  const ssVals = ssSeries.map((x) => x.v);

  const last7 = (vals: number[]) => (vals.length >= 2 ? vals.slice(-7) : null);
  const withSeries = (series: SeriesPt[]) => (series.length >= 2 ? series : undefined);

  // Body Battery breakdown (charged/drained)
  const bbItems: { label: string; val: string; pct: number; color?: string }[] = [];
  if (p.bodyBattery.charged != null)
    bbItems.push({ label: "Charged", val: `+${p.bodyBattery.charged}`, pct: 100, color: "var(--good)" });
  if (p.bodyBattery.drained != null)
    bbItems.push({
      label: "Drained",
      val: `−${p.bodyBattery.drained}`,
      pct: p.bodyBattery.charged ? Math.min(100, (p.bodyBattery.drained / p.bodyBattery.charged) * 100) : 100,
      color: "var(--bad)",
    });

  // Sleep stage breakdown
  const sleepStageItems = (() => {
    const sl = p.sleep;
    if (!sl) return [];
    const stages = [
      { label: "Deep", v: sl.deepS },
      { label: "Light", v: sl.lightS },
      { label: "REM", v: sl.remS },
      { label: "Awake", v: sl.awakeS },
    ].filter((x) => x.v != null) as { label: string; v: number }[];
    const total = stages.reduce((a, b) => a + b.v, 0);
    if (total <= 0) return [];
    return stages.map((x) => ({
      label: x.label,
      val: fmtHm(x.v / 3600),
      pct: (x.v / total) * 100,
      color: STAGE_COLORS[x.label],
    }));
  })();

  // HRV status counts breakdown
  const hrvStatusItems = p.hrvStatusCounts.map((c) => ({
    label: c.status.charAt(0).toUpperCase() + c.status.slice(1),
    val: `${c.days} day${c.days === 1 ? "" : "s"}`,
    pct: (c.days / 7) * 100,
    color: c.status === "balanced" ? "var(--good)" : c.status === "low" || c.status === "poor" ? "var(--bad)" : "var(--caution)",
  }));

  const metrics: MockupMetric[] = [
    {
      id: "sleep",
      label: "Sleep",
      value: sleepLatest != null ? fmtHm(sleepLatest) : "—",
      unit: "",
      delta: sleepDelta.delta,
      tone: sleepDelta.tone,
      fmt: "time",
      base: sleepLatest ?? 7.5,
      vol: 0.6,
      band: band(sleepVals, [6, 9]),
      series: withSeries(sleepSeries),
      spark: last7(sleepVals),
      bd: sleepStageItems.length ? { title: "Sleep stages · last night", items: sleepStageItems } : undefined,
    },
    {
      id: "hrv",
      label: "HRV",
      value: latest(hrvVals) != null ? String(Math.round(latest(hrvVals)!)) : "—",
      unit: "ms",
      ...deltaInt(hrvVals),
      fmt: "int",
      base: latest(hrvVals) ?? 60,
      vol: 6,
      band:
        s?.hrvBaselineLowMs != null && s?.hrvBaselineHighMs != null
          ? [s.hrvBaselineLowMs, s.hrvBaselineHighMs]
          : band(hrvVals, [40, 90]),
      series: withSeries(hrvSeries),
      spark: last7(hrvVals),
      bd: hrvStatusItems.length ? { title: "HRV status · 7 days", items: hrvStatusItems } : undefined,
    },
    {
      id: "stress",
      label: "Stress",
      value: latest(stressVals) != null ? String(Math.round(latest(stressVals)!)) : "—",
      unit: "avg",
      ...deltaInt(stressVals, true),
      fmt: "int",
      base: latest(stressVals) ?? 30,
      vol: 7,
      band: band(stressVals, [10, 60]),
      series: withSeries(stressSeries),
      spark: last7(stressVals),
      bd: p.stressBuckets.length ? { title: "Stress levels · today", items: mapItems(p.stressBuckets) } : undefined,
    },
    {
      id: "rhr",
      label: "Resting HR",
      value: latest(rhrVals) != null ? String(Math.round(latest(rhrVals)!)) : "—",
      unit: "bpm",
      ...deltaInt(rhrVals, true),
      fmt: "int",
      base: latest(rhrVals) ?? 50,
      vol: 2.5,
      band: band(rhrVals, [45, 60]),
      series: withSeries(rhrSeries),
      spark: last7(rhrVals),
    },
    {
      id: "battery",
      label: "Body Battery",
      value: latest(bbVals) != null ? String(Math.round(latest(bbVals)!)) : "—",
      unit: "%",
      ...deltaInt(bbVals),
      fmt: "int",
      base: latest(bbVals) ?? 60,
      vol: 12,
      band: band(bbVals, [20, 100]),
      series: withSeries(bbSeries),
      spark: last7(bbVals),
      bd: bbItems.length ? { title: "Today", items: bbItems } : undefined,
    },
    {
      id: "sleepscore",
      label: "Sleep score",
      value: latest(ssVals) != null ? String(Math.round(latest(ssVals)!)) : "—",
      unit: "/100",
      ...deltaInt(ssVals),
      fmt: "int",
      base: latest(ssVals) ?? 75,
      vol: 6,
      band: band(ssVals, [60, 95]),
      series: withSeries(ssSeries),
      spark: last7(ssVals),
      bd: p.sleepContributors.length ? { title: "Contributors", items: mapItems(p.sleepContributors) } : undefined,
    },
  ];

  const meta = readinessMeta(s?.readinessScore ?? null);
  const readinessSeries = buildSeries(h, (d) => d.readinessScore);
  const readinessVals = readinessSeries.map((x) => x.v);

  // Only show metrics backed by real data (a drawable series); never fabricate.
  const shown = metrics.filter((m) => m.series && m.series.length >= 2);
  const hasHrv = shown.some((m) => m.id === "hrv");
  const empty = !s && shown.length === 0 ? "No data yet — run a Garmin sync to populate your readiness." : undefined;

  return {
    pulse: {
      name: "Pulse",
      where: "Daily readiness",
      date: fmtDate(p.day),
      trendKey: "hrv",
      empty,
      hero: {
        type: "dial",
        value: s?.readinessScore ?? 0,
        label: "Readiness",
        status: meta.status,
        state: meta.state,
        sub: "MORNING VALUE",
      },
      metrics: shown,
      trend: hasHrv ? { type: "line", title: "HRV · 7 days", unit: "ms" } : undefined,
    },
    heroFactors: {
      base: s?.readinessScore ?? 70,
      band: band(readinessVals, [40, 95]),
      series: withSeries(readinessSeries),
      factors: p.factors.map((f) => ({ name: f.name, val: f.value, pct: f.pct, state: f.state })),
    },
  };
}
