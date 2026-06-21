import type { ForgeData } from "@/lib/db/queries/forge";
import { band, deltaInt, flat, readinessMeta, spark, thousands, weekdayNarrow } from "@/lib/mockup-shared";

interface BdItem {
  label: string;
  val: string;
  pct: number;
  color?: string;
}
interface MockupMetric {
  id: string;
  label: string;
  value: string;
  unit: string;
  delta: string;
  tone: "pos" | "neg" | "neu";
  fmt: "int" | "1dp" | "2dp" | "time";
  band: [number, number];
  series?: { v: number; date: string }[];
  spark?: number[] | null;
  bd?: { title: string; items: BdItem[] };
}

export interface ForgeMockup {
  forge: {
    name: string;
    where: string;
    date: string;
    trendKey: string;
    empty?: string;
    hero: { type: "body"; value: number; label: string; status: string; state: string; muscles: { group: string; days: number; vol: number }[] };
    metrics: MockupMetric[];
    trend?: { type: "bars"; title: string; unit: string; points: number[]; labels: string[] };
  };
  heroFactors: { base: number; band: [number, number]; series?: { v: number; date: string }[]; factors: null };
}

function acwrStatus(ratio: number | null): { label: string; tone: "pos" | "neg" | "neu" } {
  if (ratio == null) return { label: "—", tone: "neu" };
  if (ratio < 0.8) return { label: "detraining", tone: "neg" };
  if (ratio <= 1.3) return { label: "optimal", tone: "pos" };
  if (ratio <= 1.5) return { label: "high", tone: "neu" };
  return { label: "spike", tone: "neg" };
}

export function toMockupForge(d: ForgeData): ForgeMockup {
  const meta = readinessMeta(d.readinessScore);
  const hero = {
    type: "body" as const,
    value: d.readinessScore ?? 0,
    label: "Training readiness",
    status: meta.status,
    state: meta.state,
    muscles: d.muscles,
  };
  const heroFactors = {
    base: d.readinessScore ?? 70,
    band: band(d.readinessSeries.map((p) => p.v), [40, 95]),
    series: d.readinessSeries.length ? flat(d.readinessSeries) : undefined,
    factors: null,
  };

  if (!d.hasData) {
    return {
      forge: {
        name: "Forge",
        where: "Strength & conditioning",
        date: "",
        trendKey: "volume",
        empty: "No strength training in the last 30 days.",
        hero,
        metrics: [],
      },
      heroFactors,
    };
  }

  const metrics: MockupMetric[] = [];

  // Volume
  const volVals = d.volumeBySession.map((p) => p.v);
  if (d.volumeBySession.length) {
    metrics.push({
      id: "volume",
      label: "Volume",
      value: thousands(d.weeklyVolumeKg),
      unit: "kg / wk",
      ...deltaInt(volVals),
      fmt: "int",
      band: band(volVals, [0, 1]),
      series: flat(d.volumeBySession),
      spark: spark(volVals),
      bd: d.volumeByMuscle.length
        ? {
            title: "Volume by muscle · last 7 days",
            items: d.volumeByMuscle.map((m) => ({
              label: m.group,
              val: `${thousands(m.kg)} kg`,
              pct: (m.kg / Math.max(1, d.volumeByMuscle[0].kg)) * 100,
            })),
          }
        : undefined,
    });
  }

  // Weekly sets
  const setVals = d.setsBySession.map((p) => p.v);
  if (d.setsBySession.length) {
    metrics.push({
      id: "sets",
      label: "Weekly sets",
      value: String(d.weeklySets),
      unit: "sets",
      ...deltaInt(setVals),
      fmt: "int",
      band: band(setVals, [0, 1]),
      series: flat(d.setsBySession),
      spark: spark(setVals),
    });
  }

  // Top set
  const topVals = d.topSetBySession.map((p) => p.v);
  if (d.topSet && d.topSetBySession.length) {
    metrics.push({
      id: "topset",
      label: "Top set",
      value: String(Math.round(d.topSet.weightKg)),
      unit: `kg × ${d.topSet.reps}`,
      ...deltaInt(topVals),
      fmt: "int",
      band: band(topVals, [0, 1]),
      series: flat(d.topSetBySession),
      spark: spark(topVals),
    });
  }

  // Load (ACWR)
  const acwrVals = d.acwrByDay.map((p) => p.v);
  if (d.acwr.ratio != null && d.acwrByDay.length) {
    const st = acwrStatus(d.acwr.ratio);
    metrics.push({
      id: "acwr",
      label: "Load",
      value: d.acwr.ratio.toFixed(2),
      unit: "ACWR",
      delta: st.label,
      tone: st.tone,
      fmt: "2dp",
      band: band(acwrVals, [0.5, 1.6]),
      series: flat(d.acwrByDay),
      spark: spark(acwrVals),
      bd: {
        title: "Acute vs chronic load",
        items: [
          { label: "Acute · 7d", val: `${Math.round(d.acwr.acute ?? 0)} AU`, pct: 100, color: "var(--accent)" },
          {
            label: "Chronic · 28d",
            val: `${Math.round(d.acwr.chronic ?? 0)} AU`,
            pct: d.acwr.acute ? Math.min(100, ((d.acwr.chronic ?? 0) / d.acwr.acute) * 100) : 100,
            color: "#FBBF8F",
          },
          { label: "Ratio", val: `${d.acwr.ratio.toFixed(2)} · ${st.label}`, pct: Math.min(100, (d.acwr.ratio / 1.5) * 100), color: "var(--good)" },
        ],
      },
    });
  }

  const trendPts = d.volumeBySession.slice(-7);
  const trend = trendPts.length
    ? { type: "bars" as const, title: "Volume · recent sessions", unit: "kg", points: trendPts.map((p) => p.v), labels: trendPts.map((p) => weekdayNarrow(p.date)) }
    : undefined;

  return {
    forge: {
      name: "Forge",
      where: "Strength & conditioning",
      date: d.lastSession?.name ?? "",
      trendKey: "volume",
      hero,
      metrics,
      trend,
    },
    heroFactors,
  };
}
