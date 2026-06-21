"use client";

import { useState } from "react";

import { Dial } from "@/components/app/Dial";
import { DetailSheet } from "@/components/app/DetailSheet";
import { GearIcon } from "@/components/app/icons";
import { MetricTile } from "@/components/app/MetricTile";
import { TrendPanel } from "@/components/app/TrendPanel";
import type { DetailView } from "@/lib/detail-view";
import {
  PULSE_TILES,
  deltaTone,
  formatValue,
  seriesFor,
  tileById,
  type TileDef,
} from "@/lib/pulse-config";
import type { BreakdownItem, FactorState, PulseData, SeriesPoint } from "@/lib/pulse-types";

const WHERE = "Daily readiness";

function humanize(s: string): string {
  return s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function readinessMeta(score: number | null): { label: string; state: FactorState } {
  if (score == null) return { label: "No reading", state: "caution" };
  if (score >= 80) return { label: "Primed", state: "good" };
  if (score >= 60) return { label: "Ready", state: "good" };
  if (score >= 40) return { label: "Moderate", state: "caution" };
  return { label: "Take it easy", state: "bad" };
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function seriesPoints(data: PulseData, key: TileDef["key"]): SeriesPoint[] {
  return data.history.map((d) => {
    const v = d[key];
    return { date: d.day, value: typeof v === "number" ? v : null };
  });
}

// ── breakdown builders (today's drill-down content) ──────────────────────────

function sleepStageItems(data: PulseData): BreakdownItem[] {
  const s = data.sleep;
  if (!s) return [];
  const stages = [
    { label: "Deep", s: s.deepS, color: "#2D7DF6" },
    { label: "Light", s: s.lightS, color: "#7FB2FF" },
    { label: "REM", s: s.remS, color: "#A78BFA" },
    { label: "Awake", s: s.awakeS, color: "#C9D1DC" },
  ];
  const total = stages.reduce((a, b) => a + (b.s ?? 0), 0);
  if (total <= 0) return [];
  return stages
    .filter((st) => st.s != null)
    .map((st) => ({
      label: st.label,
      value: formatValue(st.s as number, "duration"),
      pct: ((st.s as number) / total) * 100,
      color: st.color,
    }));
}

function hrvStatusItems(data: PulseData): BreakdownItem[] {
  const color = (status: string) =>
    status === "balanced" ? "var(--good)" : status === "low" || status === "poor" ? "var(--bad)" : "var(--caution)";
  return data.hrvStatusCounts.map((c) => ({
    label: humanize(c.status),
    value: `${c.days} day${c.days === 1 ? "" : "s"}`,
    pct: (c.days / 7) * 100,
    color: color(c.status),
  }));
}

function bodyBatteryItems(data: PulseData): BreakdownItem[] {
  const { charged, drained } = data.bodyBattery;
  const out: BreakdownItem[] = [];
  if (charged != null) out.push({ label: "Charged", value: `+${charged}`, pct: 100, color: "var(--good)" });
  if (drained != null)
    out.push({
      label: "Drained",
      value: `−${drained}`,
      pct: charged ? Math.min(100, (drained / charged) * 100) : 100,
      color: "var(--bad)",
    });
  return out;
}

function breakdownFor(def: TileDef, data: PulseData): DetailView["breakdown"] {
  switch (def.breakdown) {
    case "sleepStages":
      return { title: "Sleep stages · last night", variant: "items", items: sleepStageItems(data) };
    case "hrvStatus":
      return { title: "HRV status · 7 days", variant: "items", items: hrvStatusItems(data) };
    case "stressBuckets":
      return { title: "Stress levels · today", variant: "items", items: data.stressBuckets };
    case "bodyBattery":
      return { title: "Today", variant: "items", items: bodyBatteryItems(data) };
    case "sleepContributors":
      return { title: "Contributors", variant: "items", items: data.sleepContributors };
    default:
      return undefined;
  }
}

function buildTileView(def: TileDef, data: PulseData): DetailView {
  const band: [number, number] | undefined =
    def.id === "hrv" && data.summary?.hrvBaselineLowMs != null && data.summary?.hrvBaselineHighMs != null
      ? [data.summary.hrvBaselineLowMs, data.summary.hrvBaselineHighMs]
      : undefined;
  return {
    where: `${WHERE} · Pulse`,
    title: def.label,
    unit: def.unit,
    fmt: def.fmt,
    series: seriesPoints(data, def.key),
    band,
    breakdown: breakdownFor(def, data),
  };
}

function buildHeroView(data: PulseData): DetailView {
  return {
    where: WHERE,
    title: "Readiness",
    unit: "",
    fmt: "int",
    series: data.history.map((d) => ({ date: d.day, value: d.readinessScore })),
    breakdown: { title: "What drove it", variant: "factors", factors: data.factors },
  };
}

// ── component ────────────────────────────────────────────────────────────────

export function PulseDashboard({ data }: { data: PulseData }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const view: DetailView | null =
    openKey === "hero"
      ? buildHeroView(data)
      : openKey
        ? (() => {
            const def = tileById(openKey);
            return def ? buildTileView(def, data) : null;
          })()
        : null;

  if (!data.summary) {
    return (
      <div className="l-stack anim">
        <Topbar day={data.day} />
        <div className="panel">
          <div className="empty">
            No data yet. Run a Garmin sync (`docker compose run --rm worker daily`) and your readiness will appear here.
          </div>
        </div>
      </div>
    );
  }

  const s = data.summary;
  const meta = readinessMeta(s.readinessScore);
  const hrvSeries = seriesFor(data.history, tileById("hrv")!).slice(-7);
  const dayLabels = data.history.slice(-7).map((d) => new Date(`${d.day}T00:00:00`).toLocaleDateString(undefined, { weekday: "narrow" }));

  return (
    <>
      <div className="l-stack anim">
        <Topbar day={data.day} />

        <button type="button" className="panel hero tap" onClick={() => setOpenKey("hero")} aria-label="Readiness details">
          <Dial
            value={s.readinessScore}
            label="Readiness"
            status={meta.label}
            state={meta.state}
            sub="MORNING VALUE"
          />
        </button>

        <div className="grid2">
          {PULSE_TILES.map((def) => {
            const series = seriesFor(data.history, def);
            const raw = s[def.key];
            return (
              <MetricTile
                key={def.id}
                label={def.label}
                value={formatValue(typeof raw === "number" ? raw : null, def.fmt)}
                unit={def.unit}
                delta={deltaTone(series, def.lowerIsBetter)}
                spark={series.slice(-7)}
                onOpen={() => setOpenKey(def.id)}
              />
            );
          })}
        </div>

        <TrendPanel
          title="HRV · last 7 days"
          unit="ms"
          values={hrvSeries}
          labels={dayLabels}
          onOpen={() => setOpenKey("hrv")}
        />
      </div>

      <DetailSheet view={view} open={openKey != null} onClose={() => setOpenKey(null)} />
    </>
  );
}

function Topbar({ day }: { day: string }) {
  return (
    <div className="topbar">
      <div>
        <div className="where">{WHERE}</div>
        <h2>Pulse</h2>
        <div className="date">{fmtDate(day)}</div>
      </div>
      <div className="gear" aria-hidden>
        <GearIcon />
      </div>
    </div>
  );
}
