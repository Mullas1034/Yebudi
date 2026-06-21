"use client";

import { ChevronRight } from "@/components/app/icons";
import { Sparkline } from "@/components/app/Sparkline";

// The dashboard's headline trend panel (Pulse: HRV · last 7 days, line variant).
export function TrendPanel({
  title,
  unit,
  values,
  labels,
  onOpen,
}: {
  title: string;
  unit: string;
  values: (number | null)[];
  labels: string[];
  onOpen: () => void;
}) {
  return (
    <button type="button" className="panel trend tap" onClick={onOpen} aria-label={`${title} details`}>
      <span className="chev">
        <ChevronRight />
      </span>
      <div className="t-top">
        <span className="eyebrow">{title}</span>
        <span className="unit">{unit}</span>
      </div>
      <div style={{ height: 84 }}>
        <Sparkline values={values} width={300} height={84} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        {labels.map((l, i) => (
          <span key={i} className="unit">
            {l}
          </span>
        ))}
      </div>
    </button>
  );
}
