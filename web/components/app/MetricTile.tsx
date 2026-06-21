"use client";

import { ChevronRight } from "@/components/app/icons";
import { Sparkline } from "@/components/app/Sparkline";
import type { Trend } from "@/lib/pulse-config";

const ARROW: Record<Trend, string> = { pos: "▲", neg: "▼", neu: "–" };

export function MetricTile({
  label,
  value,
  unit,
  delta,
  spark,
  onOpen,
}: {
  label: string;
  value: string;
  unit: string;
  delta: { tone: Trend; text: string };
  spark: (number | null)[];
  onOpen: () => void;
}) {
  return (
    <button type="button" className="tile tap" onClick={onOpen} aria-label={`${label} details`}>
      <span className="chev">
        <ChevronRight />
      </span>
      <div className="m-head">
        <span className="eyebrow">{label}</span>
        <span className={`delta t-${delta.tone}`}>
          {ARROW[delta.tone]} {delta.text}
        </span>
      </div>
      <div className="m-val">
        <span className="num">{value}</span>
        {unit && <span className="unit">{unit}</span>}
      </div>
      <div className="m-spark">
        <Sparkline values={spark} />
      </div>
    </button>
  );
}
