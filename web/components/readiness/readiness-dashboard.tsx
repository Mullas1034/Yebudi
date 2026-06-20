import { ReadinessRing } from "@/components/readiness/readiness-ring";
import {
  BodyBatteryCard,
  HrvStatusCard,
  SleepScoreCard,
} from "@/components/readiness/metric-cards";
import {
  deriveReadinessInsight,
  formatLongDate,
  greeting,
  readinessBand,
} from "@/lib/format";
import type { MorningReadiness } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ReadinessDashboard({ data }: { data: MorningReadiness }) {
  const band = readinessBand(data.readinessScore);
  const updated = new Date(data.computedAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-4 pb-12 pt-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{greeting()}</p>
          <h1 className="text-xl font-semibold tracking-tight">{formatLongDate(data.day)}</h1>
        </div>
        <span className={cn("rounded-full border px-3 py-1 text-xs font-medium", band.text)}>
          {band.label}
        </span>
      </header>

      {/* Hero: the single most important glance */}
      <section className="mt-8 flex flex-col items-center">
        <ReadinessRing value={data.readinessScore ?? 0} className={band.ring}>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Readiness
          </span>
          <span className="text-5xl font-bold tracking-tight tabular-nums">
            {data.readinessScore ?? "—"}
          </span>
          <span className={cn("text-sm font-medium", band.text)}>{band.label}</span>
        </ReadinessRing>
        <p className="mt-5 max-w-xs text-balance text-center text-sm text-muted-foreground">
          {deriveReadinessInsight(data)}
        </p>
      </section>

      {/* Drill-down: tap any card for detail */}
      <section className="mt-8 space-y-3">
        <h2 className="px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          This morning
        </h2>
        <BodyBatteryCard data={data} />
        <HrvStatusCard data={data} />
        <SleepScoreCard data={data} />
      </section>

      <footer className="mt-8 text-center text-xs text-muted-foreground">
        Updated {updated} · from <code className="text-muted-foreground">daily_summary</code>
      </footer>
    </main>
  );
}
