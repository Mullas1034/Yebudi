/* eslint-disable */
// Verbatim port of the approved mockup's <script> (garmin-mockups-detail (1).html),
// wrapped as runMockup(data). The ONLY changes vs the original:
//   • MODES.pulse and HERO_FACTORS.pulse come from injected real data (forge/pitch stay
//     as the mockup's sample data for now).
//   • genSeries() and the hero history use a real `meta.series` ({v,date}[]) when present,
//     so drill-down charts/stat-grids show real history instead of synthetic data.
//   • a keydown listener cleanup is returned for React unmount.
// Everything else is 1:1 with the mockup so it renders identically.

export function runMockup(data) {
  const state = { mode: "pulse", sex: "male" };
  const detailState = { key: null, srcRect: null, range: "week" };
  const TODAY = new Date(2026, 5, 15);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const RANGES = [["week", "Week"], ["month", "Month"], ["year", "Year"], ["max", "Max"], ["custom", "Custom"]];
  const RCFG = { week: { n: 7, unit: "day" }, month: { n: 30, unit: "day" }, year: { n: 12, unit: "month" }, max: { n: 24, unit: "month" }, custom: { n: 14, unit: "day" } };

  const ICONS = {
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-6 4 14 2-8h6"/></svg>',
    forge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5h11M6.5 17.5h11M9 6.5v11M15 6.5v11M3 9h3M3 15h3M18 9h3M18 15h3"/></svg>',
    pitch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z"/><path d="M12 8.5 14.6 10.4 13.6 13.5h-3.2L9.4 10.4 12 8.5Z"/></svg>'
  };

  const MODES = {
    pulse: data.pulse,
    forge: {
      name: "Forge", where: "Strength & recovery", date: "Sun 14 Jun · 06:42", trendKey: "volume",
      hero: {
        type: "body", value: 74, label: "Training readiness", status: "Legs loaded", state: "caution",
        muscles: [{ group: "Chest", days: 2, vol: .85 }, { group: "Back", days: 3, vol: .7 }, { group: "Shoulders", days: 2.5, vol: .55 }, { group: "Arms", days: 2.2, vol: .4 }, { group: "Core", days: 1.5, vol: .5 }, { group: "Legs", days: 1, vol: .95 }]
      },
      metrics: [
        { id: "volume", label: "Volume", value: "8,240", unit: "kg", delta: "+6%", tone: "pos", spark: [6, 7, 6, 8, 7, 8, 8], base: 8.24, vol: .9, band: [5, 9], fmt: "1dp", bd: { title: "Volume by muscle · this week", items: [{ label: "Chest", val: "9.2k", pct: 100 }, { label: "Back", val: "8.1k", pct: 88 }, { label: "Legs", val: "7.4k", pct: 80 }, { label: "Shoulders", val: "4.6k", pct: 50 }, { label: "Arms", val: "3.8k", pct: 41 }] } },
        { id: "sets", label: "Weekly sets", value: "96", unit: "sets", delta: "+8", tone: "pos", spark: [70, 78, 82, 88, 90, 94, 96], base: 96, vol: 9, band: [70, 110], fmt: "int" },
        { id: "topset", label: "Top set", value: "100", unit: "kg × 5", delta: "PR", tone: "pos", spark: [90, 92, 94, 95, 97, 98, 100], base: 100, vol: 4, band: [85, 105], fmt: "int" },
        { id: "acwr", label: "Load", value: "1.08", unit: "ACWR", delta: "optimal", tone: "pos", spark: [0.9, 0.95, 1.0, 1.05, 1.1, 1.07, 1.08], base: 1.08, vol: .1, band: [0.8, 1.5], fmt: "2dp", bd: { title: "Acute vs chronic load", items: [{ label: "Acute · 7d", val: "420 AU", pct: 100, color: "var(--accent)" }, { label: "Chronic · 28d", val: "389 AU", pct: 93, color: "#FBBF8F" }, { label: "Ratio", val: "1.08 · optimal", pct: 72, color: "var(--good)" }] } },
        { id: "lastsession", label: "Last session", value: "52", unit: "min", delta: "Thu", tone: "neu", spark: [48, 55, 50, 58, 52, 60, 52], base: 52, vol: 8, band: [40, 65], fmt: "int", bd: { title: "Last session · volume by lift", items: [{ label: "Bench press", val: "3,200 kg", pct: 100 }, { label: "Incline DB", val: "2,640 kg", pct: 82 }, { label: "Dips", val: "1,560 kg", pct: 49 }, { label: "Cable fly", val: "840 kg", pct: 26 }] } },
        { id: "sessions", label: "Sessions", value: "4", unit: "/ wk", delta: "on plan", tone: "neu", spark: [3, 4, 3, 4, 4, 5, 4], base: 4, vol: .8, band: [3, 5], fmt: "int" }
      ],
      trend: { type: "bars", title: "Volume · this week", unit: "× 1000 kg", points: [6.2, 0, 7.8, 8.2, 5.1, 0, 3.4], labels: ["M", "T", "W", "T", "F", "S", "S"] }
    },
    pitch: {
      name: "Pitch", where: "Field hockey", date: "vs Wanderers · Sat", trendKey: "zones",
      hero: { type: "dial", value: 85, label: "Match readiness", status: "Primed", state: "good", sub: "GAME IN 2 DAYS" },
      metrics: [
        { id: "distance", label: "Distance", value: "6.8", unit: "km", delta: "+0.4", tone: "pos", spark: [5.9, 6.1, 6, 6.3, 6.5, 6.6, 6.8], base: 6.8, vol: .5, band: [5.5, 7.5], fmt: "1dp", bd: { title: "Distance by speed band", items: [{ label: ">23 km/h", val: "310 m", pct: 100, color: "#1A56C4" }, { label: "19–23", val: "640 m", pct: 78, color: "var(--accent)" }, { label: "15–19", val: "1.42 km", pct: 55, color: "#7FB2FF" }, { label: "<15", val: "4.43 km", pct: 38, color: "#C9D9F5" }] } },
        { id: "speed", label: "Top speed", value: "28.4", unit: "km/h", delta: "+0.6", tone: "pos", spark: [26, 27, 27.5, 28, 27.8, 28.2, 28.4], base: 28.4, vol: .7, band: [26, 29.5], fmt: "1dp" },
        { id: "timehi", label: "High-speed", value: "4:12", unit: "min", delta: "+0:18", tone: "pos", spark: [3.2, 3.5, 3.8, 3.9, 4.0, 4.1, 4.2], base: 4.2, vol: .5, band: [2.8, 5.2], fmt: "1dp", bd: { title: "Time above 19 km/h", items: [{ label: "Sprint >23", val: "1:04", pct: 100, color: "#1A56C4" }, { label: "High 19–23", val: "3:08", pct: 74, color: "var(--accent)" }] } },
        { id: "avghr", label: "Avg / max HR", value: "156", unit: "/ 184", delta: "bpm", tone: "neu", spark: [150, 158, 162, 160, 165, 159, 156], base: 156, vol: 8, band: [140, 178], fmt: "int", bd: { title: "Heart rate · match", items: [{ label: "Average", val: "156 bpm", pct: 85, color: "var(--accent)" }, { label: "Max", val: "184 bpm", pct: 100, color: "#E23838" }, { label: "Time >85% max", val: "22 min", pct: 31, color: "#F97316" }] } },
        { id: "hi", label: "HI efforts", value: "142", unit: "sprints", delta: "+14", tone: "pos", spark: [110, 120, 118, 130, 125, 138, 142], base: 142, vol: 12, band: [110, 150], fmt: "int" },
        { id: "sprint", label: "Sprint load", value: "88", unit: "%", delta: "peak", tone: "neu", spark: [70, 75, 80, 84, 86, 87, 88], base: 88, vol: 6, band: [70, 95], fmt: "int" },
        { id: "accel", label: "Accelerations", value: "64", unit: "count", delta: "+9", tone: "pos", spark: [40, 48, 52, 55, 58, 60, 64], base: 64, vol: 8, band: [40, 70], fmt: "int" },
        { id: "load", label: "Player load", value: "412", unit: "AU", delta: "+30", tone: "neu", spark: [300, 330, 350, 370, 380, 400, 412], base: 412, vol: 30, band: [300, 450], fmt: "int" }
      ],
      trend: { type: "zones", title: "Time in HR zones", zones: [{ z: "Z5", pct: 8, c: "#E23838" }, { z: "Z4", pct: 22, c: "#F97316" }, { z: "Z3", pct: 34, c: "#E0A800" }, { z: "Z2", pct: 24, c: "#16A34A" }, { z: "Z1", pct: 12, c: "#2D9CDB" }] }
    }
  };

  const HERO_FACTORS = {
    pulse: data.heroFactors,
    pitch: {
      base: 85, band: [70, 95], factors: [
        { name: "Recovery", val: "82 · ready", pct: 82, state: "good" },
        { name: "Sprint freshness", val: "88% · peak", pct: 88, state: "good" },
        { name: "HI load", val: "tapering well", pct: 80, state: "good" },
        { name: "Sleep", val: "7h 04m", pct: 78, state: "good" },
        { name: "Soreness", val: "low", pct: 85, state: "good" }]
    },
    forge: { base: 74, band: [55, 90], factors: null }
  };

  // Inject real data for every mode (overrides any sample literals above — nothing
  // displayed comes from the samples).
  MODES.pulse = data.pulse;
  MODES.forge = data.forge;
  MODES.pitch = data.pitch;
  HERO_FACTORS.pulse = data.heroFactors.pulse;
  HERO_FACTORS.forge = data.heroFactors.forge;
  HERO_FACTORS.pitch = data.heroFactors.pitch;

  /* ---------- utilities ---------- */
  function reduceMotion() { return window.matchMedia("(prefers-reduced-motion:reduce)").matches }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
  function fmtVal(v, fmt) { if (fmt === "time") { const h = Math.floor(v), m = Math.round((v - h) * 60); return `${h}h ${String(m).padStart(2, "0")}m` } if (fmt === "1dp") return (Math.round(v * 10) / 10).toFixed(1); if (fmt === "2dp") return (Math.round(v * 100) / 100).toFixed(2); return String(Math.round(v)) }

  function genSeries(meta, range) {
    // Real history only — no fabrication. Slice day-grain by range; return all otherwise.
    const all = (meta.series || []).map(p => ({ v: p.v, date: new Date(p.date) }));
    if (all.length < 2) return all;
    const cfg = RCFG[range];
    return cfg.unit === "day" ? all.slice(-cfg.n) : all;
  }

  /* ---------- dashboard pieces ---------- */
  function dialSVG(value, size) {
    const r = size / 2 - 14, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r, sweep = 0.75, start = 135;
    const prog = (value / 100) * sweep * C; let ticks = ""; const n = 37;
    for (let i = 0; i < n; i++) {
      const a = (start + (i / (n - 1)) * 270) * Math.PI / 180, major = i % 6 === 0, r1 = r + 8, r2 = r + (major ? 2 : 5);
      ticks += `<line x1="${cx + r1 * Math.cos(a)}" y1="${cy + r1 * Math.sin(a)}" x2="${cx + r2 * Math.cos(a)}" y2="${cy + r2 * Math.sin(a)}" stroke="var(--tick)" stroke-width="${major ? 2 : 1}" opacity="${major ? 1 : .65}"/>`
    }
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g transform="rotate(135 ${cx} ${cy})"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--track)" stroke-width="9" stroke-dasharray="${sweep * C} ${C}" stroke-linecap="round"/><circle id="arc" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--accent)" stroke-width="9" stroke-dasharray="${prog} ${C}" stroke-linecap="round" data-full="${C}" data-prog="${prog}"/></g>${ticks}</svg>`;
  }
  function dialBlock(h, size) { return `<div class="dialwrap"><div class="dial" style="width:${size}px;height:${size}px">${dialSVG(h.value, size)}<div class="center"><div class="big" style="font-size:${size * 0.34}px">${h.value}</div><div class="lbl">${h.label}</div></div></div><div class="pill s-${h.state}"><span class="dot"></span>${h.status}</div>${h.sub ? `<div class="sub">${h.sub}</div>` : ""}</div>` }
  function ragCss(pct) { const c = pct >= 80 ? [30, 184, 92] : pct >= 60 ? [245, 161, 30] : [238, 59, 59]; return `rgb(${c[0]},${c[1]},${c[2]})`; }
  const BODY_PTS = [[100, 12], [118, 16], [126, 32], [124, 50], [116, 64], [110, 73], [114, 82], [128, 90], [142, 101], [148, 116], [151, 150], [151, 182], [148, 214], [147, 236], [151, 252], [150, 263], [146, 270], [138, 269], [132, 258], [132, 212], [132, 178], [129, 150], [125, 124], [123, 150], [119, 196], [120, 230], [130, 250], [134, 300], [131, 344], [126, 388], [122, 408], [117, 424], [106, 430], [110, 426], [113, 408], [108, 344], [103, 300], [100, 254]];
  function femalePt(p) {
    let x = p[0], y = p[1], dx = x - 100, s = 1;
    if (y >= 88 && y <= 120) s = 0.86; else if (y >= 150 && y <= 215) s = 0.85; else if (y >= 238 && y <= 278) s = 1.22; else if (y > 120) s = 0.95;
    return [100 + dx * s, y];
  }
  function crClosed(pts) {
    const n = pts.length; let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)} `;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6, c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)} `;
    }
    return d + "Z";
  }
  const MALE_D = "M80.10,429.33 C80.10,429.17 81.72,424.62 83.70,419.21 C86.76,410.83 87.03,407.75 85.54,398.39 C84.21,390.08 84.47,382.98 86.61,369.36 C88.17,359.44 89.73,338.71 90.08,323.29 C90.43,307.87 92.00,287.11 93.57,277.17 C95.13,267.22 96.94,251.96 97.57,243.25 C98.80,226.50 101.77,221.50 101.87,236.02 C101.90,240.74 103.14,253.15 104.62,263.60 C109.08,294.99 111.11,320.04 109.96,329.67 C109.30,335.25 110.32,348.03 112.61,362.73 C115.62,382.13 115.99,388.85 114.52,398.04 C112.96,407.80 113.21,410.75 116.30,419.21 C118.28,424.62 119.90,429.37 119.90,429.76 C119.90,431.55 136.83,428.31 139.05,426.09 C141.18,423.96 140.65,422.32 135.48,415.05 C127.72,404.13 126.13,393.20 129.71,375.42 C134.80,350.21 136.09,333.68 134.61,312.56 C133.56,297.56 133.84,287.87 135.62,277.29 C139.42,254.74 139.39,213.23 135.56,195.45 C131.72,177.63 131.27,156.47 134.41,140.87 C137.36,126.21 138.73,128.55 143.43,156.28 C145.86,170.62 149.23,182.76 153.65,193.06 C158.89,205.26 160.19,210.49 159.93,218.38 C159.49,231.90 161.51,249.34 163.37,248.19 C164.21,247.67 165.74,248.69 166.78,250.45 C168.42,253.24 168.90,253.30 170.48,250.94 C172.02,248.63 172.30,248.71 172.32,251.50 C172.34,253.30 173.08,254.31 173.98,253.76 C174.88,253.20 175.32,249.29 174.96,245.06 L174.29,237.37 L176.29,245.06 C179.30,256.63 181.76,254.42 180.32,241.44 C179.09,230.29 179.12,230.18 182.64,233.30 C184.59,235.05 186.67,236.47 187.25,236.47 C189.24,236.47 181.73,222.89 176.78,217.55 C172.52,212.95 171.47,209.52 169.31,193.13 C167.93,182.65 165.55,169.19 164.03,163.22 C160.82,150.66 158.58,135.72 156.37,112.11 C154.65,93.84 152.68,90.07 142.83,86.27 C139.66,85.06 131.49,81.56 124.65,78.51 L112.23,72.95 L113.20,63.53 C113.74,58.35 115.49,52.10 117.11,49.64 C119.58,45.87 119.75,43.34 118.21,33.65 C115.97,19.57 110.81,14.00 100.00,14.00 C89.26,14.00 84.02,19.59 81.83,33.39 C80.25,43.32 80.47,45.45 83.69,51.45 C85.70,55.20 87.34,61.61 87.34,65.71 L87.34,73.15 L75.13,78.61 C68.42,81.61 60.34,85.06 57.17,86.27 C47.12,90.15 45.24,93.85 43.57,113.07 C41.68,134.88 39.54,149.18 36.05,163.22 C34.57,169.19 32.42,181.80 31.28,191.25 C29.91,202.60 28.02,210.12 25.72,213.41 C23.80,216.14 20.67,220.62 18.76,223.36 C16.86,226.09 14.71,230.37 14.00,232.85 L12.70,237.37 L16.83,233.76 L20.96,230.14 L19.81,241.44 C18.50,254.36 20.77,256.49 23.65,245.06 L25.59,237.37 L25.32,244.06 C25.17,247.74 25.63,251.33 26.35,252.05 C27.07,252.76 27.66,252.20 27.68,250.79 C27.70,248.68 28.03,248.70 29.52,250.94 C31.10,253.30 31.58,253.24 33.22,250.45 C34.26,248.69 35.78,247.66 36.61,248.17 C38.92,249.60 40.45,238.33 40.08,222.63 C39.77,209.85 40.40,206.94 46.34,193.46 C50.67,183.64 54.19,171.41 56.57,157.91 C61.74,128.62 62.59,126.92 65.63,139.95 C68.89,153.93 68.40,177.03 64.47,195.42 C60.78,212.66 60.49,254.38 63.93,272.95 C65.13,279.46 65.93,298.46 65.77,316.96 C65.54,343.48 66.19,353.17 69.30,369.27 C74.08,393.99 73.11,403.53 64.68,414.57 C59.66,421.15 59.03,422.94 60.88,425.47 C63.20,428.64 73.95,431.76 77.84,430.40 C79.09,429.97 80.10,429.49 80.10,429.33 Z";
  const FEMALE_D = "M80.69,429.33 C80.68,429.17 82.16,424.62 83.99,419.21 C86.87,410.83 87.10,407.75 85.46,398.39 C83.98,390.08 84.12,382.98 86.11,369.36 C87.59,359.44 88.99,338.71 89.20,323.29 C89.41,307.87 90.96,287.11 92.66,277.17 C94.39,267.22 96.55,251.96 97.36,243.25 C98.82,226.50 101.68,221.50 101.97,236.02 C102.04,240.74 103.55,253.15 105.34,263.60 C110.18,294.99 112.14,320.04 110.78,329.67 C110.01,335.25 110.96,348.03 113.18,362.73 C115.99,382.13 116.24,388.85 114.60,398.04 C112.89,407.80 113.10,410.75 116.01,419.21 C117.84,424.62 119.31,429.37 119.30,429.76 C119.30,431.55 135.79,428.31 138.05,426.09 C140.22,423.96 139.78,422.32 135.01,415.05 C127.69,404.13 126.42,393.20 130.64,375.42 C136.86,350.21 138.89,333.68 138.11,312.56 C137.52,297.56 138.20,287.87 140.63,277.29 C144.81,254.74 134.84,213.23 130.41,195.45 C127.09,177.63 127.81,156.47 131.01,140.87 C133.75,126.21 134.98,128.55 138.63,156.28 C139.70,170.62 141.89,182.76 145.84,193.06 C150.55,205.26 151.98,210.49 155.36,218.38 C161.07,231.90 168.46,249.34 170.22,248.19 C171.00,247.67 172.99,248.69 174.66,250.45 C177.33,253.24 177.89,253.30 178.95,250.94 C179.94,248.63 180.27,248.71 181.19,251.50 C181.78,253.30 182.95,254.31 183.79,253.76 C184.63,253.20 183.82,249.29 182.02,245.06 L178.78,237.37 L183.48,245.06 C190.81,256.63 192.83,254.42 186.62,241.44 C180.22,230.29 180.18,230.18 185.70,233.30 C188.84,235.05 191.56,236.47 192.17,236.47 C194.28,236.47 178.29,222.89 170.44,217.55 C163.99,212.95 161.45,209.52 159.22,193.13 C157.80,182.65 156.90,169.19 156.22,163.22 C154.67,150.66 152.84,135.72 151.04,112.11 C149.64,93.84 147.87,90.07 138.94,86.27 C136.08,85.06 128.66,81.56 122.45,78.51 L111.15,72.95 L112.05,63.53 C112.55,58.35 114.17,52.10 115.65,49.64 C117.92,45.87 118.09,43.34 116.70,33.65 C114.68,19.57 109.95,14.00 100.00,14.00 C90.12,14.00 85.31,19.59 83.34,33.39 C81.92,43.32 82.12,45.45 85.09,51.45 C86.93,55.20 88.44,61.61 88.45,65.71 L88.46,73.15 L77.36,78.61 C71.26,81.61 63.92,85.06 61.06,86.27 C51.94,90.15 50.26,93.85 48.91,113.07 C47.38,134.88 45.58,149.18 43.86,163.22 C43.21,169.19 42.52,181.80 41.33,191.25 C39.90,202.60 38.03,210.12 34.19,213.41 C30.91,216.14 25.37,220.62 21.89,223.36 C18.33,226.09 13.45,230.37 11.10,232.85 L7.43,237.37 L13.46,233.76 L19.92,230.14 L13.53,241.44 C7.48,254.36 9.31,256.49 16.45,245.06 L21.09,237.37 L18.61,244.06 C17.23,247.74 16.57,251.33 17.14,252.05 C17.72,252.76 18.57,252.20 19.04,250.79 C19.74,248.68 20.09,248.70 21.05,250.94 C22.11,253.30 22.67,253.24 25.34,250.45 C27.01,248.69 29.00,247.66 29.76,248.17 C31.94,249.60 36.60,238.33 42.71,222.63 C48.21,209.85 48.80,206.94 54.15,193.46 C58.01,183.64 60.41,171.41 61.49,157.91 C65.44,128.62 66.21,126.92 69.02,139.95 C72.20,153.93 72.99,177.03 69.62,195.42 C65.48,212.66 55.14,254.38 58.68,272.95 C60.31,279.46 61.94,298.46 62.47,316.96 C63.24,343.48 64.30,353.17 68.14,369.27 C73.81,393.99 73.12,403.53 65.13,414.57 C60.47,421.15 59.94,422.94 61.86,425.47 C64.25,428.64 74.73,431.76 78.51,430.40 C79.71,429.97 80.69,429.49 80.69,429.33 Z";
  function bodyOutline(sex) { return sex === "female" ? FEMALE_D : MALE_D; }
  function femaleScale(y) { const ys = [14, 150, 180, 210, 235, 260, 430], ss = [0.92, 0.90, 0.85, 0.86, 1.05, 1.16, 0.97]; if (y <= ys[0]) return ss[0]; if (y >= ys[ys.length - 1]) return ss[ss.length - 1]; let i = 0; while (y > ys[i + 1]) i++; const t = (y - ys[i]) / (ys[i + 1] - ys[i]); return ss[i] + (ss[i + 1] - ss[i]) * t; }
  function bodyZones(view, rec, sex) {
    const z = []; const add = (cx, cy, rx, ry, g) => { if (sex === "female") cx = 100 + (cx - 100) * femaleScale(cy); z.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${ragCss(rec[g])}"/>`); };
    if (view === "front") { add(64, 104, 13, 12, "Shoulders"); add(136, 104, 13, 12, "Shoulders"); add(82, 124, 15, 13, "Chest"); add(118, 124, 15, 13, "Chest"); add(56, 140, 9, 22, "Arms"); add(144, 140, 9, 22, "Arms"); add(48, 192, 8, 22, "Arms"); add(152, 192, 8, 22, "Arms"); add(100, 178, 15, 32, "Core"); add(85, 288, 16, 44, "Legs"); add(115, 288, 16, 44, "Legs"); }
    else { add(64, 104, 13, 12, "Shoulders"); add(136, 104, 13, 12, "Shoulders"); add(100, 140, 27, 40, "Back"); add(56, 140, 9, 22, "Arms"); add(144, 140, 9, 22, "Arms"); add(48, 192, 8, 22, "Arms"); add(152, 192, 8, 22, "Arms"); add(85, 250, 17, 17, "Legs"); add(115, 250, 17, 17, "Legs"); add(85, 296, 15, 38, "Legs"); add(115, 296, 15, 38, "Legs"); add(86, 376, 12, 30, "Legs"); add(114, 376, 12, 30, "Legs"); }
    return z.join("");
  }
  function bodyFigureSVG(view, rec, sex) {
    const o = bodyOutline(sex), id = sex + "_" + view;
    return `<svg viewBox="0 0 200 440" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><defs><clipPath id="cp_${id}"><path d="${o}"/></clipPath><filter id="bl_${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter><filter id="sh_${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter><linearGradient id="bg_${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEF4FB" stop-opacity="0.72"/><stop offset="1" stop-color="#DFE7F3" stop-opacity="0.5"/></linearGradient></defs><path d="${o}" fill="rgba(20,30,55,0.22)" filter="url(#sh_${id})" transform="translate(0,3)"/><path d="${o}" fill="url(#bg_${id})"/><g clip-path="url(#cp_${id})" filter="url(#bl_${id})" opacity="0.66">${bodyZones(view, rec, sex)}</g><path d="${o}" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="1.5"/><path d="${o}" fill="none" stroke="rgba(20,30,55,0.16)" stroke-width="0.7"/></svg>`;
  }
  function muscleRecovery(days, vol) { const full = 1.4 + 2.6 * vol; const r = Math.min(1, days / full); return Math.round(100 * (0.15 + 0.85 * r)); }
  function bodyBlock(h) {
    const rec = {}; h.muscles.forEach(x => { x._pct = muscleRecovery(x.days, x.vol); rec[x.group] = x._pct; });
    const legend = h.muscles.map(x => `<div class="leg-row"><span class="leg-dot" style="background:${ragCss(x._pct)}"></span>${x.group} <b>${x._pct}%</b></div>`).join("");
    return `<div class="forge-hero"><div class="bodywrap"><div class="flipcard" id="flipcard"><div class="flip-face flip-front">${bodyFigureSVG("front", rec, state.sex)}</div><div class="flip-face flip-back">${bodyFigureSVG("back", rec, state.sex)}</div></div><div class="legend">${legend}</div></div><div class="forge-foot"><div class="flip-toggle" id="flipToggle"><button class="ft-seg ft-on" type="button" data-face="front">Front</button><button class="ft-seg" type="button" data-face="back">Back</button></div><div class="pill s-${h.state}"><span class="dot"></span>${h.value}% · ${h.status}</div></div></div>`;
  }
  function sparkSVG(pts, w, h, dot) { if (!pts) return ""; const mn = Math.min(...pts), mx = Math.max(...pts), rng = (mx - mn) || 1, pad = 3; const X = i => pad + (i / (pts.length - 1)) * (w - 2 * pad), Y = v => pad + (1 - (v - mn) / rng) * (h - 2 * pad); const line = pts.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" "); const id = "g" + Math.random().toString(36).slice(2, 7); return `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".26"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs><polygon points="${pad},${h - pad} ${line} ${w - pad},${h - pad}" fill="url(#${id})"/><polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${dot ? `<circle cx="${X(pts.length - 1).toFixed(1)}" cy="${Y(pts[pts.length - 1]).toFixed(1)}" r="2.6" fill="var(--accent)"/>` : ""}</svg>` }
  const arrow = t => t === "pos" ? "▲" : t === "neg" ? "▼" : "–";
  function metricTile(m) { return `<div class="tile tap" data-detail="${m.id}" tabindex="0" role="button"><span class="chev">${ICONS.chev}</span><div class="m-head"><span class="eyebrow">${m.label}</span><span class="delta t-${m.tone}">${arrow(m.tone)} ${m.delta}</span></div><div class="m-val"><span class="num">${m.value}</span>${m.unit ? `<span class="unit">${m.unit}</span>` : ""}</div>${m.spark ? `<div class="m-spark">${sparkSVG(m.spark, 120, 30, true)}</div>` : ""}</div>` }
  function trendPanel(t, key) {
    let inner = "";
    if (t.type === "line") { const m = byId("hrv"); const sp = m.spark; inner = `<div style="height:84px">${sparkSVG(sp, 300, 84, true)}</div><div style="display:flex;justify-content:space-between;margin-top:8px">${["M", "T", "W", "T", "F", "S", "S"].map(l => `<span class="bar-lab">${l}</span>`).join("")}</div>` }
    else if (t.type === "bars") { const mx = Math.max(...t.points) || 1; inner = `<div class="bars">${t.points.map((v, i) => { const h = v <= 0 ? 0 : Math.max(8, (v / mx) * 72); return `<div class="bar-col"><div class="bar${v <= 0 ? ' empty' : ''}" style="height:${h}px"></div><span class="bar-lab">${t.labels[i]}</span></div>` }).join("")}</div>` }
    else if (t.type === "zones") { inner = t.zones.map(x => `<div class="zone"><span class="z-tag">${x.z}</span><span class="z-track"><span class="z-fill" style="width:${x.pct}%;background:${x.c}"></span></span><span class="z-pct">${x.pct}%</span></div>`).join("") }
    return `<div class="panel trend tap" data-detail="${key}" tabindex="0" role="button"><span class="chev">${ICONS.chev}</span><div class="t-top"><span class="eyebrow">${t.title}</span><span class="unit">${t.unit || "% of session"}</span></div>${inner}</div>`;
  }
  function topbar(d) { return `<div class="topbar"><div><div class="where">${d.where}</div><h2>${d.name}</h2><div class="date">${d.date}</div></div><div class="gear">${ICONS.gear}</div></div>` }
  function heroBlock(d) { return d.hero.type === "dial" ? dialBlock(d.hero, 210) : bodyBlock(d.hero) }
  function byId(id) { return MODES[state.mode].metrics.find(m => m.id === id) }

  function pitchMapPanel(map) {
    if (!map || !map.path || map.path.length < 2) return ""; // no real GPS → hide
    const W = 300, H = 380, m = 13, L = m, R = W - m, T = m, B = H - m, MIDX = (L + R) / 2, MIDY = (T + B) / 2, len = B - T, wid = R - L;
    const wht = "rgba(255,255,255,0.85)";
    let mk = "";
    mk += `<rect x="${L}" y="${T}" width="${wid}" height="${len}" rx="6" fill="none" stroke="${wht}" stroke-width="2"/>`;
    mk += `<line x1="${L}" y1="${MIDY}" x2="${R}" y2="${MIDY}" stroke="${wht}" stroke-width="1.5"/>`;
    mk += `<line x1="${L}" y1="${(T + 0.25 * len).toFixed(1)}" x2="${R}" y2="${(T + 0.25 * len).toFixed(1)}" stroke="${wht}" stroke-width="1" opacity="0.65"/>`;
    mk += `<line x1="${L}" y1="${(T + 0.75 * len).toFixed(1)}" x2="${R}" y2="${(T + 0.75 * len).toFixed(1)}" stroke="${wht}" stroke-width="1" opacity="0.65"/>`;
    const rD = (0.30 * wid).toFixed(1);
    mk += `<path d="M ${(MIDX - rD).toFixed(1)} ${T} A ${rD} ${rD} 0 0 0 ${(MIDX + +rD).toFixed(1)} ${T}" fill="none" stroke="${wht}" stroke-width="1.5"/>`;
    mk += `<path d="M ${(MIDX - rD).toFixed(1)} ${B} A ${rD} ${rD} 0 0 1 ${(MIDX + +rD).toFixed(1)} ${B}" fill="none" stroke="${wht}" stroke-width="1.5"/>`;
    mk += `<rect x="${MIDX - 14}" y="${T - 3}" width="28" height="3" fill="${wht}"/><rect x="${MIDX - 14}" y="${B}" width="28" height="3" fill="${wht}"/>`;
    mk += `<circle cx="${MIDX}" cy="${(T + 0.14 * len).toFixed(1)}" r="1.6" fill="${wht}"/><circle cx="${MIDX}" cy="${(B - 0.14 * len).toFixed(1)}" r="1.6" fill="${wht}"/>`;
    // Real GPS: normalized [x,y] in 0..1 → pitch rect, with a little inset.
    const PX = (p) => [L + 4 + p[0] * (wid - 8), T + 4 + p[1] * (len - 8)];
    const fmtPts = (seg) => seg.map((p) => { const q = PX(p); return `${q[0].toFixed(1)},${q[1].toFixed(1)}`; }).join(" ");
    const poly = fmtPts(map.path);
    let spr = "";
    (map.sprints || []).forEach((seg) => { if (!seg || seg.length < 2) return; spr += `<polyline points="${fmtPts(seg)}" fill="none" stroke="#1A56C4" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>`; });
    const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block"><defs><linearGradient id="turf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DCE8FA"/><stop offset="1" stop-color="#CADCF4"/></linearGradient></defs><rect x="${L}" y="${T}" width="${wid}" height="${len}" rx="6" fill="url(#turf)"/>${mk}<polyline points="${poly}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>${spr}</svg>`;
    const km = map.distanceKm != null ? `${map.distanceKm} km covered` : "";
    const legend = `<div style="display:flex;gap:14px;align-items:center;margin-top:10px;font-size:11px;color:var(--ink-3,#6c7888)"><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:14px;height:3px;border-radius:2px;background:var(--accent);opacity:.5"></span>Run</span><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:14px;height:3px;border-radius:2px;background:#1A56C4"></span>Sprint</span><span style="margin-left:auto;font-variant-numeric:tabular-nums;font-weight:600;color:var(--ink-2,#3a4453)">${km}</span></div>`;
    return `<div class="panel"><div class="t-top"><span class="eyebrow">Movement</span><span class="unit">GPS map</span></div><div style="border-radius:12px;overflow:hidden;margin-top:6px;background:#CADCF4">${svg}</div>${legend}</div>`;
  }
  function buildDashboard() {
    const d = MODES[state.mode];
    if (d.empty) {
      return `<div class="l-stack anim">${topbar(d)}<div class="panel"><div class="empty">${d.empty}</div></div></div>`;
    }
    const cards = (d.metrics || []).slice(0, 4).map(metricTile).join("");
    const extra = state.mode === "pitch" ? pitchMapPanel(data.pitchMap) : "";
    const trend = d.trend ? trendPanel(d.trend, d.trendKey) : "";
    return `<div class="l-stack anim">${topbar(d)}<div class="panel hero tap" data-detail="hero" tabindex="0" role="button"><span class="chev">${ICONS.chev}</span>${heroBlock(d)}</div><div class="grid2">${cards}</div>${extra}${trend}</div>`;
  }

  /* ---------- detail content ---------- */
  function rangebar() { return `<div class="rangebar" id="rangebar">${RANGES.map(([k, l]) => `<button class="rb" data-range="${k}" aria-pressed="${k === detailState.range}">${l}</button>`).join("")}</div>` }
  function customRow() { const a = new Date(TODAY); a.setDate(a.getDate() - 13); const f = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; return `<div class="customrow"><span>From</span><input type="date" value="${f(a)}"><span>to</span><input type="date" value="${f(TODAY)}"><button onclick="window.__yebudiRenderDetail&&window.__yebudiRenderDetail()">Apply</button></div>` }
  function statGrid(pts, meta) { const vals = pts.map(p => p.v); const avg = vals.reduce((a, b) => a + b, 0) / vals.length; const mn = Math.min(...vals), mx = Math.max(...vals), lt = vals[vals.length - 1]; const u = meta.fmt === "time" ? "" : (meta.unit || ""); const cell = (lab, v) => `<div class="stat"><div class="lab">${lab}</div><div class="v">${fmtVal(v, meta.fmt)}</div>${u ? `<div class="u">${u}</div>` : ""}</div>`; return `<div class="statgrid">${cell("Avg", avg)}${cell("Min", mn)}${cell("Max", mx)}${cell("Latest", lt)}</div>` }
  function breakdownBlock(m) {
    const bd = m.bd;
    if (!bd || !bd.items || !bd.items.length) return ""; // no real breakdown → render nothing
    const mx = Math.max(...bd.items.map(i => i.pct || 0)) || 100;
    const rows = bd.items.map(i => `<div class="bdrow"><span class="bl">${i.label}</span><span class="bdtrack"><span class="bdfill" style="width:${(i.pct / mx * 100).toFixed(0)}%;background:${i.color || "var(--accent)"}"></span></span><span class="bdval">${i.val}</span></div>`).join("");
    return `<div class="sec-lab">${bd.title}</div><div class="panel bd">${rows}</div>`;
  }
  function chartCard(meta) { return `<div class="panel chartcard"><div class="chartbox" id="chartbox"><div class="crosshair" id="xhair"></div><div class="cdot" id="cdot"></div><div class="ctip" id="ctip"></div></div><div class="xaxis" id="xaxis"></div><div class="bandtag"><i></i> your typical range</div></div>` }

  function detailContent() {
    const k = detailState.key;
    if (k === "hero") {
      const d = MODES[state.mode], hf = HERO_FACTORS[state.mode];
      const factors = (hf.factors && hf.factors.length)
        ? hf.factors
        : (d.hero.muscles ? d.hero.muscles.map(x => { const p = muscleRecovery(x.days, x.vol); return { name: x.group, val: p + "% · trained " + x.days + "d ago", pct: p, color: ragCss(p) }; }) : []);
      const fcol = s => s === "good" ? "var(--good)" : s === "caution" ? "var(--caution)" : "var(--bad)";
      const frows = factors.map(f => { const c = f.color || fcol(f.state); return `<div class="factor"><span class="fstate" style="background:${c}"></span><div class="fl"><div class="fname">${f.name}</div><div class="fval">${f.val}</div></div><span class="fbar"><i style="width:${f.pct}%;background:${c}"></i></span></div>`; }).join("");
      const drove = factors.length ? `<div class="sec-lab">What drove it</div><div class="panel bd">${frows}</div>` : "";
      const heroMeta = { id: state.mode + "-score", band: hf.band, fmt: "int", unit: "", series: hf.series };
      const history = (hf.series && hf.series.length >= 2)
        ? `<div class="sec-lab">History</div>${rangebar()}${detailState.range === "custom" ? customRow() : ""}${chartCard(heroMeta)}${statGrid(genSeries(heroMeta, detailState.range), heroMeta)}`
        : "";
      return { where: d.where, title: d.hero.label, html: `${drove}${history}`, meta: heroMeta };
    }
    if (k === "zones") {
      const d = MODES[state.mode];
      const zones = (d.trend && d.trend.zones) ? d.trend.zones : [];
      const items = zones.map(z => ({ label: z.z + " " + ({ Z5: "Max", Z4: "Threshold", Z3: "Aerobic", Z2: "Easy", Z1: "Recovery", Z0: "Rest" }[z.z] || ""), val: z.pct + "%", pct: z.pct, color: z.c }));
      const mx = Math.max(1, ...items.map(i => i.pct));
      const rows = items.map(i => `<div class="bdrow"><span class="bl">${i.label}</span><span class="bdtrack"><span class="bdfill" style="width:${(i.pct / mx * 100).toFixed(0)}%;background:${i.color}"></span></span><span class="bdval">${i.val}</span></div>`).join("");
      return { where: d.where, title: "Time in HR zones", html: `<div class="sec-lab">Last game</div><div class="panel bd">${rows}</div>`, meta: null };
    }
    const m = byId(k), d = MODES[state.mode];
    return { where: d.where + " · " + d.name, title: m.label, html: `${rangebar()}${detailState.range === "custom" ? customRow() : ""}${chartCard(m)}${statGrid(genSeries(m, detailState.range), m)}${breakdownBlock(m)}`, meta: m };
  }

  function bigChart(meta) {
    const box = document.getElementById("chartbox"); if (!box) return;
    const W = box.clientWidth || 320, H = 212, padL = 4, padR = 4, padT = 10, padB = 26;
    const pts = genSeries(meta, detailState.range);
    const vals = pts.map(p => p.v);
    let lo = Math.min(...vals, meta.band[0]), hi = Math.max(...vals, meta.band[1]); const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad;
    const X = i => padL + (i / (pts.length - 1)) * (W - padL - padR);
    const Y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    const line = pts.map((p, i) => `${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
    const yHi = Y(meta.band[1]), yLo = Y(meta.band[0]);
    const id = "ch" + Math.random().toString(36).slice(2, 6);
    let grid = ""; for (let g = 1; g <= 2; g++) { const yy = padT + (g / 3) * (H - padT - padB); grid += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="var(--line)"/>` }
    const svg = `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" id="chartsvg"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".30"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>${grid}<rect x="${padL}" y="${yHi.toFixed(1)}" width="${W - padL - padR}" height="${(yLo - yHi).toFixed(1)}" fill="color-mix(in srgb,var(--accent) 14%,transparent)"/><line x1="${padL}" y1="${yHi.toFixed(1)}" x2="${W - padR}" y2="${yHi.toFixed(1)}" stroke="color-mix(in srgb,var(--accent) 45%,transparent)" stroke-width="1" stroke-dasharray="3 3"/><line x1="${padL}" y1="${yLo.toFixed(1)}" x2="${W - padR}" y2="${yLo.toFixed(1)}" stroke="color-mix(in srgb,var(--accent) 45%,transparent)" stroke-width="1" stroke-dasharray="3 3"/><polygon points="${padL},${H - padB} ${line} ${W - padR},${H - padB}" fill="url(#${id})"/><polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${X(pts.length - 1).toFixed(1)}" cy="${Y(pts[pts.length - 1].v).toFixed(1)}" r="3.4" fill="var(--accent)" stroke="#fff" stroke-width="1.5"/></svg>`;
    box.querySelector("#chartsvg")?.remove();
    box.insertAdjacentHTML("afterbegin", svg);
    const ax = document.getElementById("xaxis"); const cfg = RCFG[detailState.range]; const ticks = 5; let lab = "";
    for (let i = 0; i < ticks; i++) { const idx = Math.round(i / (ticks - 1) * (pts.length - 1)); const d = pts[idx].date; lab += `<span>${cfg.unit === "month" ? MONTHS[d.getMonth()] : d.getDate()}</span>` }
    ax.innerHTML = lab;
    const xhair = document.getElementById("xhair"), cdot = document.getElementById("cdot"), ctip = document.getElementById("ctip");
    function at(clientX) { const r = box.getBoundingClientRect(); let rx = clientX - r.left; rx = Math.max(0, Math.min(r.width, rx)); const i = Math.round(rx / r.width * (pts.length - 1)); const px = X(i) / W * r.width, py = Y(pts[i].v) / H * r.height; xhair.style.left = px + "px"; cdot.style.left = px + "px"; cdot.style.top = py + "px"; const d = pts[i].date; ctip.innerHTML = `<b>${fmtVal(pts[i].v, meta.fmt)}${meta.fmt === "time" ? "" : (meta.unit ? " " + meta.unit : "")}</b>${d.getDate()} ${MONTHS[d.getMonth()]}`; ctip.style.left = Math.max(36, Math.min(r.width - 36, px)) + "px"; [xhair, cdot, ctip].forEach(e => e.style.opacity = 1) }
    function off() { [xhair, cdot, ctip].forEach(e => e.style.opacity = 0) }
    box.onpointerdown = e => { box.setPointerCapture(e.pointerId); at(e.clientX) };
    box.onpointermove = e => { if (e.pressure > 0 || e.buttons || e.pointerType === "mouse") at(e.clientX) };
    box.onpointerup = off; box.onpointerleave = () => { if (!box.hasPointerCapture) off() };
    box.onmousemove = e => at(e.clientX); box.onmouseleave = off;
  }

  function renderDetail() {
    const c = detailContent();
    const dInner = document.getElementById("dInner");
    dInner.innerHTML = `<div class="drag" id="drag"><div class="grabber"></div><div class="d-head"><button class="d-back" id="dBack" aria-label="Back to dashboard">${ICONS.back}</button><div class="d-title"><div class="where">${c.where}</div><h3>${c.title}</h3></div></div></div><div class="d-body">${c.html}</div>`;
    document.getElementById("dBack").onclick = () => closeDetail(false);
    document.querySelectorAll("#rangebar .rb").forEach(b => b.onclick = () => { detailState.range = b.dataset.range; renderDetail() });
    dInner.scrollTop = 0; updateScrolled();
    bindMouseDrag();
    requestAnimationFrame(() => bigChart(c.meta));
  }
  window.__yebudiRenderDetail = renderDetail;

  /* ---------- the dive ---------- */
  function openDetail(key, el) {
    detailState.key = key; detailState.range = "week";
    const det = document.getElementById("detail"), scr = document.getElementById("screen");
    const sr = scr.getBoundingClientRect(), pr = el.getBoundingClientRect();
    det.style.transition = "none";
    det.style.top = (pr.top - sr.top) + "px"; det.style.left = (pr.left - sr.left) + "px";
    det.style.width = pr.width + "px"; det.style.height = pr.height + "px"; det.style.borderRadius = "20px";
    det.style.transform = ""; det.style.opacity = "1"; det.style.display = "block";
    renderDetail();
    void det.offsetWidth;
    det.style.transition = "";
    requestAnimationFrame(() => { det.classList.add("open"); det.style.top = "0px"; det.style.left = "0px"; det.style.width = "100%"; det.style.height = "100%"; det.style.borderRadius = "0px" });
  }
  function finishClose() {
    const det = document.getElementById("detail");
    det.style.display = "none"; det.style.transition = ""; det.style.transform = ""; det.style.opacity = "";
    det.classList.remove("scrolled", "dragging", "open");
  }
  function closeDetail(slide) {
    const det = document.getElementById("detail"), scr = document.getElementById("screen");
    det.classList.remove("open", "dragging");
    if (reduceMotion()) { finishClose(); return; }
    let onEnd;
    if (slide) {
      det.style.transition = "transform .32s ease,opacity .32s ease";
      det.style.transform = "translateY(120%)"; det.style.opacity = "0";
      onEnd = ev => { if (ev.propertyName === "transform") { det.removeEventListener("transitionend", onEnd); finishClose(); } };
    } else {
      det.style.transform = ""; det.style.opacity = "1";
      const el = document.querySelector(`[data-detail="${detailState.key}"]`);
      if (el) {
        const sr = scr.getBoundingClientRect(), pr = el.getBoundingClientRect();
        det.style.top = (pr.top - sr.top) + "px"; det.style.left = (pr.left - sr.left) + "px"; det.style.width = pr.width + "px"; det.style.height = pr.height + "px"; det.style.borderRadius = "20px";
      }
      else { det.style.transform = "translateY(40px)"; det.style.opacity = "0"; }
      onEnd = ev => { if (ev.propertyName === "width") { det.removeEventListener("transitionend", onEnd); finishClose(); } };
    }
    det.addEventListener("transitionend", onEnd);
  }

  let _drag = { sy: 0, dy: 0, engaged: false, ok: false };
  function dragStart(y, target) {
    const det = document.getElementById("detail"), dInner = document.getElementById("dInner");
    _drag.sy = y; _drag.dy = 0; _drag.engaged = false;
    const atTop = dInner.scrollTop <= 2 && !det.classList.contains("scrolled");
    const onChart = target && target.closest && target.closest(".chartbox");
    _drag.ok = atTop && !onChart;
  }
  function dragMove(y, ev) {
    if (!_drag.ok) return;
    const det = document.getElementById("detail"), dInner = document.getElementById("dInner");
    _drag.dy = y - _drag.sy;
    if (_drag.dy > 0 && dInner.scrollTop <= 2) {
      _drag.engaged = true;
      if (ev && ev.cancelable) ev.preventDefault();
      det.classList.add("dragging");
      det.style.transform = `translateY(${_drag.dy}px) scale(${Math.max(.92, 1 - _drag.dy / 2400)})`;
      det.style.opacity = String(Math.max(.4, 1 - _drag.dy / 600));
    } else if (_drag.engaged) {
      _drag.dy = 0; det.style.transform = ""; det.style.opacity = "1";
    }
  }
  function dragEnd() {
    const det = document.getElementById("detail");
    if (_drag.engaged) {
      det.classList.remove("dragging");
      if (_drag.dy > 110) { closeDetail(true); } else { det.style.transform = ""; det.style.opacity = "1"; }
    }
    _drag.engaged = false; _drag.ok = false;
  }
  function bindMouseDrag() {
    const drag = document.getElementById("drag"); if (!drag) return;
    drag.onmousedown = e => {
      dragStart(e.clientY, e.target);
      if (!_drag.ok) return;
      e.preventDefault();
      const mm = ev => dragMove(ev.clientY, null);
      const mu = () => { document.removeEventListener("mousemove", mm); document.removeEventListener("mouseup", mu); dragEnd(); };
      document.addEventListener("mousemove", mm); document.addEventListener("mouseup", mu);
    };
  }
  function updateScrolled() {
    const det = document.getElementById("detail"), dInner = document.getElementById("dInner");
    if (det.style.display !== "block") return;
    det.classList.toggle("scrolled", dInner.scrollTop > 24);
  }
  function initDetailGestures() {
    const dInner = document.getElementById("dInner");
    dInner.addEventListener("scroll", updateScrolled, { passive: true });
    dInner.addEventListener("touchstart", e => { if (e.touches.length === 1) dragStart(e.touches[0].clientY, e.target); }, { passive: true });
    dInner.addEventListener("touchmove", e => { if (e.touches.length === 1) dragMove(e.touches[0].clientY, e); }, { passive: false });
    dInner.addEventListener("touchend", dragEnd);
    dInner.addEventListener("touchcancel", dragEnd);
    document.addEventListener("keydown", onKeydown);
  }
  function onKeydown(e) { if (e.key === "Escape" && document.getElementById("detail").style.display === "block") closeDetail(false); }

  /* ---------- mode + tabs ---------- */
  function tabbar() { return Object.keys(MODES).map(k => `<button class="tab${k === state.mode ? ' active' : ''}" data-mode="${k}" aria-label="${MODES[k].name}">${ICONS[k]}${MODES[k].name}</button>`).join("") }
  function animateArc() { if (reduceMotion()) return; const arc = document.getElementById("arc"); if (!arc) return; const full = arc.dataset.full, prog = arc.dataset.prog; arc.style.strokeDasharray = `0 ${full}`; arc.style.transition = "none"; requestAnimationFrame(() => requestAnimationFrame(() => { arc.style.transition = "stroke-dasharray 1.1s cubic-bezier(.2,.7,.3,1)"; arc.style.strokeDasharray = `${prog} ${full}` })) }

  function bindPanels() {
    document.querySelectorAll("[data-detail]").forEach(el => {
      el.onclick = () => openDetail(el.dataset.detail, el);
      el.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(el.dataset.detail, el) } };
    });
  }
  function renderDashboard() {
    document.getElementById("screen").dataset.mode = state.mode;
    document.getElementById("scroll").innerHTML = buildDashboard();
    document.getElementById("tabbar").innerHTML = tabbar();
    document.querySelectorAll(".switch [data-mode]").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === state.mode));
    document.querySelectorAll(".tab[data-mode]").forEach(b => b.onclick = () => setMode(b.dataset.mode));
    bindPanels(); wireForgeFlip(); wireGear(); animateArc();
  }
  function wireForgeFlip() {
    const tog = document.getElementById("flipToggle"); if (!tog) return;
    const card = document.getElementById("flipcard");
    tog.addEventListener("click", e => e.stopPropagation());
    tog.querySelectorAll(".ft-seg").forEach(seg => seg.addEventListener("click", e => {
      e.stopPropagation();
      card.classList.toggle("flipped", seg.dataset.face === "back");
      tog.querySelectorAll(".ft-seg").forEach(s => s.classList.toggle("ft-on", s === seg));
    }));
  }
  function setMode(m) { if (document.getElementById("detail").style.display === "block") closeDetail(false); state.mode = m; renderDashboard() }

  document.querySelectorAll(".switch [data-mode]").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  function wireGear() { const g = document.querySelector(".gear"); if (!g) return; g.style.cursor = "pointer"; g.setAttribute("role", "button"); g.setAttribute("tabindex", "0"); g.onclick = openSettings; g.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSettings(); } }; }
  function openSettings() {
    const s = document.getElementById("settings");
    s.innerHTML = '<div class="set-scrim" id="setScrim"></div><div class="set-sheet"><div class="set-grab"></div><div class="set-head"><h3>Settings</h3><button class="set-close" id="setClose" aria-label="Close">' + ICONS.close + '</button></div>'
      + '<div class="set-row"><div><div class="set-label">Body model</div><div class="set-sub">Used on the muscle heat map</div></div><div class="seg2" id="sexToggle"><button type="button" data-sex="male" class="' + (state.sex === "male" ? "on" : "") + '">Male</button><button type="button" data-sex="female" class="' + (state.sex === "female" ? "on" : "") + '">Female</button></div></div>'
      + '<div class="set-row"><div><div class="set-label">Units</div><div class="set-sub">Weight & distance</div></div><div class="seg2"><button type="button" class="on">Metric</button><button type="button">Imperial</button></div></div>'
      + '<div class="set-row"><div><div class="set-label">Heat-map key</div><div class="set-sub">Fresh → fatigued</div></div><div style="display:flex;gap:6px;align-items:center"><span class="key-sw" style="background:rgb(30,184,92)"></span><span class="key-sw" style="background:rgb(245,161,30)"></span><span class="key-sw" style="background:rgb(238,59,59)"></span></div></div></div>';
    s.classList.add("open");
    document.getElementById("setScrim").onclick = closeSettings;
    document.getElementById("setClose").onclick = closeSettings;
    s.querySelectorAll("#sexToggle button").forEach(b => b.onclick = () => { state.sex = b.dataset.sex; s.querySelectorAll("#sexToggle button").forEach(x => x.classList.toggle("on", x === b)); renderDashboard(); });
  }
  function closeSettings() { const s = document.getElementById("settings"); s.classList.remove("open"); setTimeout(() => { if (!s.classList.contains("open")) s.innerHTML = ""; }, 360); }

  initDetailGestures();
  renderDashboard();

  return () => {
    document.removeEventListener("keydown", onKeydown);
    delete window.__yebudiRenderDetail;
  };
}
