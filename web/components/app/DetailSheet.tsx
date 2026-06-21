"use client";

import { useRef, useState } from "react";

import { BigChart, type ChartPoint } from "@/components/app/BigChart";
import { ChevronLeft } from "@/components/app/icons";
import { formatValue } from "@/lib/pulse-config";
import { RANGES, type DetailBreakdown, type DetailView, type RangeKey } from "@/lib/detail-view";
import type { Factor } from "@/lib/pulse-types";

function StatGrid({ values, fmt, unit }: { values: number[]; fmt: DetailView["fmt"]; unit: string }) {
  if (values.length === 0) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const latest = values[values.length - 1];
  const u = fmt === "duration" ? "" : unit;
  const cell = (lab: string, v: number) => (
    <div className="stat" key={lab}>
      <div className="lab">{lab}</div>
      <div className="v">{formatValue(v, fmt)}</div>
      {u && <div className="u">{u}</div>}
    </div>
  );
  return (
    <div className="statgrid">
      {cell("Avg", avg)}
      {cell("Min", mn)}
      {cell("Max", mx)}
      {cell("Latest", latest)}
    </div>
  );
}

function fstate(state: Factor["state"]) {
  return state === "good" ? "var(--good)" : state === "caution" ? "var(--caution)" : "var(--bad)";
}

function Breakdown({ bd }: { bd: DetailBreakdown }) {
  if (bd.variant === "factors") {
    const factors = bd.factors ?? [];
    if (factors.length === 0) return null;
    return (
      <>
        <div className="sec-lab">{bd.title}</div>
        <div className="panel bd">
          {factors.map((f) => (
            <div className="factor" key={f.name}>
              <span className="fstate" style={{ background: fstate(f.state) }} />
              <div className="fl">
                <div className="fname">{f.name}</div>
                <div className="fval">{f.value}</div>
              </div>
              <span className="fbar">
                <i style={{ width: `${f.pct}%`, background: fstate(f.state) }} />
              </span>
            </div>
          ))}
        </div>
      </>
    );
  }
  const items = bd.items ?? [];
  if (items.length === 0) return null;
  const mx = Math.max(...items.map((i) => i.pct), 1);
  return (
    <>
      <div className="sec-lab">{bd.title}</div>
      <div className="panel bd">
        {items.map((i) => (
          <div className="bdrow" key={i.label}>
            <span className="bl">{i.label}</span>
            <span className="bdtrack">
              <span className="bdfill" style={{ width: `${(i.pct / mx) * 100}%`, background: i.color ?? "var(--accent)" }} />
            </span>
            <span className="bdval">{i.value}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function DetailSheet({ view, open, onClose }: { view: DetailView | null; open: boolean; onClose: () => void }) {
  const [range, setRange] = useState<RangeKey>("week");
  const detailRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ y: 0, active: false });

  if (!view) return <div className="detail" aria-hidden ref={detailRef} />;

  const days = RANGES.find((r) => r.key === range)?.days ?? 7;
  const sliced = Number.isFinite(days) ? view.series.slice(-days) : view.series;
  const points: ChartPoint[] = sliced
    .filter((p): p is { date: string; value: number } => p.value != null)
    .map((p) => ({ date: p.date, value: p.value }));
  const statValues = points.map((p) => p.value);

  // light drag-to-dismiss on the header
  function onDragStart(y: number) {
    if ((innerRef.current?.scrollTop ?? 0) > 2) return;
    drag.current = { y, active: true };
  }
  function onDragMove(y: number) {
    if (!drag.current.active || !detailRef.current) return;
    const dy = Math.max(0, y - drag.current.y);
    detailRef.current.style.transform = `translateY(${dy}px)`;
    detailRef.current.style.transition = "none";
  }
  function onDragEnd(y: number) {
    if (!drag.current.active || !detailRef.current) return;
    const dy = Math.max(0, y - drag.current.y);
    detailRef.current.style.transition = "";
    detailRef.current.style.transform = "";
    drag.current.active = false;
    if (dy > 110) onClose();
  }

  return (
    <div className={`detail${open ? " open" : ""}`} ref={detailRef}>
      <div className="d-inner" ref={innerRef}>
        <div
          className="drag"
          onPointerDown={(e) => onDragStart(e.clientY)}
          onPointerMove={(e) => e.buttons && onDragMove(e.clientY)}
          onPointerUp={(e) => onDragEnd(e.clientY)}
        >
          <div className="grabber" />
          <div className="d-head">
            <button className="d-back" onClick={onClose} aria-label="Back to dashboard">
              <ChevronLeft />
            </button>
            <div className="d-title">
              <div className="where">{view.where}</div>
              <h3>{view.title}</h3>
            </div>
          </div>
        </div>
        <div className="d-body">
          <div className="rangebar">
            {RANGES.map((r) => (
              <button key={r.key} className="rb" aria-pressed={r.key === range} onClick={() => setRange(r.key)}>
                {r.label}
              </button>
            ))}
          </div>
          <BigChart points={points} fmt={view.fmt} unit={view.unit} band={view.band} />
          <StatGrid values={statValues} fmt={view.fmt} unit={view.unit} />
          {view.breakdown && <Breakdown bd={view.breakdown} />}
        </div>
      </div>
    </div>
  );
}
