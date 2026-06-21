"use client";

import { useEffect, useRef, useState } from "react";

import { formatValue, type ValueFormat } from "@/lib/pulse-config";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface ChartPoint {
  date: string; // 'YYYY-MM-DD'
  value: number;
}

const H = 212;
const padL = 4;
const padR = 4;
const padT = 10;
const padB = 26;

// Interactive line chart with drag-to-scrub. Ported from the mockup's bigChart.
export function BigChart({
  points,
  fmt,
  unit,
  band,
}: {
  points: ChartPoint[];
  fmt: ValueFormat;
  unit: string;
  band?: [number, number];
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const xhairRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setW(el.clientWidth || 320);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length < 2) {
    return (
      <div className="panel chartcard">
        <div className="empty">Not enough history yet — keep syncing and this chart will fill in.</div>
      </div>
    );
  }

  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals, ...(band ? [band[0]] : []));
  let hi = Math.max(...vals, ...(band ? [band[1]] : []));
  const pad = (hi - lo) * 0.12 || 1;
  lo -= pad;
  hi += pad;

  const X = (i: number) => padL + (i / (points.length - 1)) * (w - padL - padR);
  const Y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const line = points.map((p, i) => `${X(i).toFixed(1)},${Y(p.value).toFixed(1)}`).join(" ");
  const gid = `bc-${points.length}-${w}`;

  const grid = [1, 2].map((g) => {
    const yy = padT + (g / 3) * (H - padT - padB);
    return <line key={g} x1={padL} y1={yy} x2={w - padR} y2={yy} stroke="var(--line)" />;
  });

  function moveTo(clientX: number) {
    const box = boxRef.current;
    if (!box) return;
    const r = box.getBoundingClientRect();
    let rx = clientX - r.left;
    rx = Math.max(0, Math.min(r.width, rx));
    const i = Math.round((rx / r.width) * (points.length - 1));
    const px = (X(i) / w) * r.width;
    const py = (Y(points[i].value) / H) * r.height;
    const d = new Date(`${points[i].date}T00:00:00`);
    if (xhairRef.current) {
      xhairRef.current.style.left = `${px}px`;
      xhairRef.current.style.opacity = "1";
    }
    if (dotRef.current) {
      dotRef.current.style.left = `${px}px`;
      dotRef.current.style.top = `${py}px`;
      dotRef.current.style.opacity = "1";
    }
    if (tipRef.current) {
      const u = fmt === "duration" ? "" : unit ? ` ${unit}` : "";
      tipRef.current.innerHTML = `<b>${formatValue(points[i].value, fmt)}${u}</b>${d.getDate()} ${MONTHS[d.getMonth()]}`;
      tipRef.current.style.left = `${Math.max(36, Math.min(r.width - 36, px))}px`;
      tipRef.current.style.opacity = "1";
    }
  }
  function hide() {
    for (const ref of [xhairRef, dotRef, tipRef]) if (ref.current) ref.current.style.opacity = "0";
  }

  // x-axis labels (5 ticks)
  const ticks = 5;
  const labels = [];
  for (let i = 0; i < ticks; i++) {
    const idx = Math.round((i / (ticks - 1)) * (points.length - 1));
    const d = new Date(`${points[idx].date}T00:00:00`);
    labels.push(`${d.getDate()} ${MONTHS[d.getMonth()]}`);
  }

  const yHi = band ? Y(band[1]) : 0;
  const yLo = band ? Y(band[0]) : 0;

  return (
    <div className="panel chartcard">
      <div
        className="chartbox"
        ref={boxRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          moveTo(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons || e.pointerType === "mouse") moveTo(e.clientX);
        }}
        onPointerUp={hide}
        onPointerLeave={hide}
      >
        <svg width="100%" height={H} viewBox={`0 0 ${w} ${H}`}>
          <defs>
            <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity={0.3} />
              <stop offset="1" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {grid}
          {band && (
            <>
              <rect
                x={padL}
                y={yHi}
                width={w - padL - padR}
                height={yLo - yHi}
                fill="color-mix(in srgb, var(--accent) 14%, transparent)"
              />
              <line x1={padL} y1={yHi} x2={w - padR} y2={yHi} stroke="color-mix(in srgb, var(--accent) 45%, transparent)" strokeDasharray="3 3" />
              <line x1={padL} y1={yLo} x2={w - padR} y2={yLo} stroke="color-mix(in srgb, var(--accent) 45%, transparent)" strokeDasharray="3 3" />
            </>
          )}
          <polygon points={`${padL},${H - padB} ${line} ${w - padR},${H - padB}`} fill={`url(#${gid})`} />
          <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={X(points.length - 1)} cy={Y(points[points.length - 1].value)} r={3.4} fill="var(--accent)" stroke="#fff" strokeWidth={1.5} />
        </svg>
        <div className="crosshair" ref={xhairRef} />
        <div className="cdot" ref={dotRef} />
        <div className="ctip" ref={tipRef} />
      </div>
      <div className="xaxis">
        {labels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      {band && (
        <div className="bandtag">
          <i /> your typical range
        </div>
      )}
    </div>
  );
}
