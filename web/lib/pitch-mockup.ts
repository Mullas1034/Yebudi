import type { PitchData } from "@/lib/db/queries/pitch";
import { band, deltaInt, flat, readinessMeta, spark } from "@/lib/mockup-shared";

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

export interface PitchMockup {
  pitch: {
    name: string;
    where: string;
    date: string;
    trendKey: string;
    empty?: string;
    hero: { type: "dial"; value: number; label: string; status: string; state: string; sub: string };
    metrics: MockupMetric[];
    trend?: { type: "zones"; title: string; zones: { z: string; pct: number; c: string }[] };
  };
  heroFactors: { base: number; band: [number, number]; series?: { v: number; date: string }[]; factors: { name: string; val: string; pct: number; state: string }[] };
  pitchMap: PitchData["gps"];
}

const ZONE_COLOR: Record<number, string> = { 0: "#94A3B8", 1: "#2D9CDB", 2: "#16A34A", 3: "#E0A800", 4: "#F97316", 5: "#E23838" };
const BAND_COLOR: Record<string, string> = { ">23 km/h": "#1A56C4", "19–23": "var(--accent)", "15–19": "#7FB2FF", "<15": "#C9D9F5" };

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m} m`;
}
function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function toMockupPitch(d: PitchData): PitchMockup {
  const meta = readinessMeta(d.readinessScore);
  const heroFactors = {
    base: d.readinessScore ?? 70,
    band: band(d.readinessSeries.map((p) => p.v), [40, 95]),
    series: d.readinessSeries.length ? flat(d.readinessSeries) : undefined,
    factors: d.factors.map((f) => ({ name: f.name, val: f.value, pct: f.pct, state: f.state })),
  };

  if (!d.hasData || !d.game) {
    return {
      pitch: {
        name: "Pitch",
        where: "Field hockey",
        date: "",
        trendKey: "zones",
        empty: "No field hockey game recorded in the last 30 days.",
        hero: { type: "dial", value: d.readinessScore ?? 0, label: "Match readiness", status: meta.status, state: meta.state, sub: "NO GAME YET" },
        metrics: [],
      },
      heroFactors,
      pitchMap: null,
    };
  }

  const g = d.game;
  const metrics: MockupMetric[] = [];

  // Distance
  if (g.distanceKm != null) {
    const vals = d.distanceSeries.map((p) => p.v);
    metrics.push({
      id: "distance",
      label: "Distance",
      value: g.distanceKm.toFixed(1),
      unit: "km",
      ...deltaInt(vals),
      fmt: "1dp",
      band: band(vals, [0, 1]),
      series: flat(d.distanceSeries),
      spark: spark(vals),
      bd: d.speedBands.some((b) => b.meters > 0)
        ? {
            title: "Distance by speed band",
            items: d.speedBands.map((b) => ({
              label: b.label,
              val: fmtDist(b.meters),
              pct: (b.meters / Math.max(1, ...d.speedBands.map((x) => x.meters))) * 100,
              color: BAND_COLOR[b.label],
            })),
          }
        : undefined,
    });
  }

  // Top speed
  if (g.topSpeedKmh != null) {
    const vals = d.topSpeedSeries.map((p) => p.v);
    metrics.push({
      id: "speed",
      label: "Top speed",
      value: g.topSpeedKmh.toFixed(1),
      unit: "km/h",
      ...deltaInt(vals),
      fmt: "1dp",
      band: band(vals, [0, 1]),
      series: flat(d.topSpeedSeries),
      spark: spark(vals),
    });
  }

  // High-speed minutes
  if (g.highSpeedMin != null) {
    const vals = d.highSpeedSeries.map((p) => p.v);
    metrics.push({
      id: "timehi",
      label: "High-speed",
      value: g.highSpeedMin.toFixed(1),
      unit: "min",
      ...deltaInt(vals),
      fmt: "1dp",
      band: band(vals, [0, 1]),
      series: flat(d.highSpeedSeries),
      spark: spark(vals),
    });
  }

  // Avg / max HR
  if (g.avgHr != null) {
    const vals = d.avgHrSeries.map((p) => p.v);
    const hrItems: BdItem[] = [
      { label: "Average", val: `${g.avgHr} bpm`, pct: g.maxHr ? (g.avgHr / g.maxHr) * 100 : 80, color: "var(--accent)" },
    ];
    if (g.maxHr != null) hrItems.push({ label: "Max", val: `${g.maxHr} bpm`, pct: 100, color: "#E23838" });
    if (d.timeAbove85Min != null) hrItems.push({ label: "Time >85% max", val: `${d.timeAbove85Min} min`, pct: g.durationS ? Math.min(100, ((d.timeAbove85Min * 60) / g.durationS) * 100) : 30, color: "#F97316" });
    metrics.push({
      id: "avghr",
      label: "Avg / max HR",
      value: String(g.avgHr),
      unit: g.maxHr != null ? `/ ${g.maxHr}` : "bpm",
      ...deltaInt(vals),
      fmt: "int",
      band: band(vals, [100, 190]),
      series: flat(d.avgHrSeries),
      spark: spark(vals),
      bd: { title: "Heart rate · match", items: hrItems },
    });
  }

  // HR zones trend
  const zTotal = d.hrZones.reduce((a, z) => a + z.seconds, 0);
  const trend =
    zTotal > 0
      ? {
          type: "zones" as const,
          title: "Time in HR zones",
          zones: d.hrZones
            .filter((z) => z.seconds > 0)
            .sort((a, b) => b.zone - a.zone)
            .map((z) => ({ z: `Z${z.zone}`, pct: Math.round((z.seconds / zTotal) * 100), c: ZONE_COLOR[z.zone] ?? "var(--accent)" })),
        }
      : undefined;

  return {
    pitch: {
      name: "Pitch",
      where: "Field hockey",
      date: `Last game · ${fmtDate(g.date)}`,
      trendKey: "zones",
      hero: { type: "dial", value: d.readinessScore ?? 0, label: "Match readiness", status: meta.status, state: meta.state, sub: (g.name || "LAST GAME").toUpperCase() },
      metrics,
      trend,
    },
    heroFactors,
    pitchMap: d.gps,
  };
}
