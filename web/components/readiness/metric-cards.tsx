import type { ReactNode } from "react";
import { BatteryCharging, HeartPulse, Moon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ExpandableCard } from "@/components/readiness/expandable-card";
import { formatDuration, hrvStatusMeta } from "@/lib/format";
import type { MorningReadiness } from "@/lib/types";
import { cn } from "@/lib/utils";

// ── shared bits ─────────────────────────────────────────────────────────────

function StatBar({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className={cn("h-full rounded-full", className)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const w = 240;
  const h = 40;
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values
    .map((v, i) => {
      const x = pad + (i / Math.max(1, values.length - 1)) * (w - 2 * pad);
      const y = h - pad - ((v - min) / span) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-10 w-full", className)}>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Body Battery ─────────────────────────────────────────────────────────────

export function BodyBatteryCard({ data }: { data: MorningReadiness }) {
  const { bodyBatteryMorning: morning, bodyBatteryHigh: high, bodyBatteryLow: low } = data;
  return (
    <ExpandableCard
      icon={<BatteryCharging className="h-5 w-5 text-emerald-300" />}
      accentClass="bg-emerald-500/15"
      title="Body Battery"
      value={morning ?? "—"}
      unit={morning != null ? "/ 100" : undefined}
      caption={high != null ? `Charged to ${high} overnight` : "No reading"}
    >
      <div className="space-y-4">
        {morning != null && (
          <StatBar value={morning} className="bg-gradient-to-r from-emerald-500 to-sky-400" />
        )}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Morning" value={morning ?? "—"} />
          <Stat label="Overnight high" value={high ?? "—"} />
          <Stat label="Yesterday low" value={low ?? "—"} />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Body Battery tracks your energy reserves. A high morning value means you recharged
          well overnight and have headroom for a hard day.
        </p>
      </div>
    </ExpandableCard>
  );
}

// ── HRV Status ───────────────────────────────────────────────────────────────

export function HrvStatusCard({ data }: { data: MorningReadiness }) {
  const meta = hrvStatusMeta(data.hrvStatus);
  const { hrvLastNightMs: last, hrvBaselineLowMs: lo, hrvBaselineHighMs: hi } = data;
  const inRange = last != null && lo != null && hi != null;
  const pos = inRange ? Math.max(0, Math.min(100, ((last - lo) / Math.max(1, hi - lo)) * 100)) : 0;

  return (
    <ExpandableCard
      icon={<HeartPulse className={cn("h-5 w-5", meta.text)} />}
      accentClass="bg-white/5"
      title="HRV Status"
      value={last ?? "—"}
      unit={last != null ? "ms" : undefined}
      badge={<Badge className={meta.badge}>{meta.label}</Badge>}
      caption={inRange ? `Baseline ${lo}–${hi} ms` : "Building baseline"}
    >
      <div className="space-y-4">
        {inRange && (
          <div>
            <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-rose-500/40 via-emerald-500/60 to-rose-500/40">
              <div
                className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded-full bg-white shadow"
                style={{ left: `${pos}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>{lo} ms</span>
              <span>balanced</span>
              <span>{hi} ms</span>
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Last night" value={last != null ? `${last} ms` : "—"} />
          <Stat label="7-day avg" value={data.hrvWeeklyAvgMs != null ? `${data.hrvWeeklyAvgMs} ms` : "—"} />
          <Stat label="Status" value={meta.label} />
        </div>
        {data.hrvTrend7d.length > 1 && (
          <div>
            <span className="text-xs text-muted-foreground">Last 7 nights</span>
            <Sparkline values={data.hrvTrend7d} className={cn("mt-1", meta.text)} />
          </div>
        )}
      </div>
    </ExpandableCard>
  );
}

// ── Sleep Score ──────────────────────────────────────────────────────────────

export function SleepScoreCard({ data }: { data: MorningReadiness }) {
  const s = data.sleep;
  const stages = s
    ? [
        { key: "Deep", v: s.deepS, c: "bg-indigo-500" },
        { key: "REM", v: s.remS, c: "bg-violet-400" },
        { key: "Light", v: s.lightS, c: "bg-sky-400" },
        { key: "Awake", v: s.awakeS, c: "bg-zinc-500" },
      ]
    : [];
  const total = stages.reduce((sum, st) => sum + st.v, 0);

  return (
    <ExpandableCard
      icon={<Moon className="h-5 w-5 text-indigo-300" />}
      accentClass="bg-indigo-500/15"
      title="Sleep Score"
      value={data.sleepScore ?? "—"}
      unit={data.sleepScore != null ? "/ 100" : undefined}
      caption={`${formatDuration(data.sleepDurationS)} asleep`}
    >
      <div className="space-y-4">
        {total > 0 && (
          <>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full">
              {stages.map((st) => (
                <div key={st.key} className={st.c} style={{ width: `${(st.v / total) * 100}%` }} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {stages.map((st) => (
                <div key={st.key} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={cn("h-2 w-2 rounded-full", st.c)} />
                    {st.key}
                  </span>
                  <span className="text-sm font-medium">{formatDuration(st.v)}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {s && (
          <div className="grid grid-cols-3 gap-3 border-t pt-3">
            <Stat label="Avg HRV" value={s.avgHrvMs != null ? `${s.avgHrvMs} ms` : "—"} />
            <Stat label="Avg SpO₂" value={s.avgSpo2 != null ? `${s.avgSpo2}%` : "—"} />
            <Stat label="Resting HR" value={s.restingHr != null ? `${s.restingHr} bpm` : "—"} />
          </div>
        )}
      </div>
    </ExpandableCard>
  );
}
