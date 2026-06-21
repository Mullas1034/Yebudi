import "server-only";

import { getDb } from "@/lib/db/client";

// ── types ────────────────────────────────────────────────────────────────────

export interface SeriesPoint {
  date: string; // 'YYYY-MM-DD'
  v: number;
}

export interface ForgeData {
  hasData: boolean;
  readinessScore: number | null;
  readinessSeries: SeriesPoint[];
  // per-session series (training days only)
  volumeBySession: SeriesPoint[];
  setsBySession: SeriesPoint[];
  topSetBySession: SeriesPoint[];
  acwrByDay: SeriesPoint[];
  // current values
  weeklyVolumeKg: number;
  weeklySets: number;
  topSet: { weightKg: number; reps: number } | null;
  acwr: { acute: number | null; chronic: number | null; ratio: number | null };
  volumeByMuscle: { group: string; kg: number }[]; // last 7 days
  lastSession: { name: string | null; durationS: number | null; byLift: { exercise: string; kg: number }[] } | null;
  muscles: { group: string; days: number; vol: number }[]; // heat-map inputs
}

const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Arms", "Core", "Legs"] as const;

// ── helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function dayStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Garmin exercise category/name → muscle group (order matters; specific first). */
function muscleGroup(category: string | null, exercise: string | null): string | null {
  const s = `${category ?? ""} ${exercise ?? ""}`.toUpperCase();
  if (/SHOULDER|DELT|LATERAL_RAISE|OVERHEAD|MILITARY|ARNOLD/.test(s)) return "Shoulders";
  if (/BENCH|CHEST|\bFLY\b|PEC|DIP|PUSH_?UP/.test(s)) return "Chest";
  if (/SQUAT|DEADLIFT|LUNGE|\bLEG\b|CALF|GLUTE|HIP_?THRUST|HAMSTRING|QUAD/.test(s)) return "Legs";
  if (/ROW|PULL|\bLAT\b|BACK|CHIN|SHRUG/.test(s)) return "Back";
  if (/CURL|TRICEP|BICEP|\bARM\b|EXTENSION|PUSHDOWN|SKULL/.test(s)) return "Arms";
  if (/PLANK|CRUNCH|\bABS?\b|CORE|SIT_?UP|OBLIQUE|LEG_?RAISE|ROTATION/.test(s)) return "Core";
  return null;
}

// ── query ────────────────────────────────────────────────────────────────────

export async function getForge(): Promise<ForgeData> {
  const curated = getDb().withSchema("curated");
  const cutoff = daysAgo(30);

  const [setRows, dailyRows] = await Promise.all([
    curated
      .selectFrom("strength_set as ss")
      .innerJoin("activity as a", "a.id", "ss.activity_id")
      .select([
        "a.id as activityId",
        "a.name as name",
        "a.start_ts as startTs",
        "a.duration_s as durationS",
        "ss.exercise as exercise",
        "ss.exercise_category as category",
        "ss.reps as reps",
        "ss.weight_kg as weightKg",
        "ss.volume_kg as volumeKg",
      ])
      .where("a.sport", "ilike", "%strength%")
      .where("a.start_ts", ">=", cutoff)
      .orderBy("a.start_ts", "asc")
      .execute(),
    curated
      .selectFrom("daily_summary")
      .select(["day", "training_load_acute", "training_load_chronic", "readiness_score"])
      .where("day", ">=", dayStr(cutoff))
      .orderBy("day", "asc")
      .execute(),
  ]);

  const readinessSeries: SeriesPoint[] = dailyRows
    .filter((r) => r.readiness_score != null)
    .map((r) => ({ date: r.day, v: r.readiness_score as number }));

  const acwrByDay: SeriesPoint[] = dailyRows
    .filter((r) => r.training_load_acute != null && r.training_load_chronic != null && (r.training_load_chronic as number) > 0)
    .map((r) => ({ date: r.day, v: (r.training_load_acute as number) / (r.training_load_chronic as number) }));

  const lastDaily = dailyRows.filter((r) => r.readiness_score != null).at(-1);
  const lastLoad = dailyRows.filter((r) => r.training_load_acute != null).at(-1);

  if (setRows.length === 0) {
    return {
      hasData: dailyRows.length > 0,
      readinessScore: lastDaily?.readiness_score ?? null,
      readinessSeries,
      volumeBySession: [],
      setsBySession: [],
      topSetBySession: [],
      acwrByDay,
      weeklyVolumeKg: 0,
      weeklySets: 0,
      topSet: null,
      acwr: {
        acute: lastLoad?.training_load_acute ?? null,
        chronic: lastLoad?.training_load_chronic ?? null,
        ratio:
          lastLoad && lastLoad.training_load_chronic
            ? (lastLoad.training_load_acute as number) / (lastLoad.training_load_chronic as number)
            : null,
      },
      volumeByMuscle: [],
      lastSession: null,
      muscles: MUSCLE_GROUPS.map((g) => ({ group: g, days: 7, vol: 0 })),
    };
  }

  // Group sets by session (activity).
  type Session = { id: number; name: string | null; date: string; ts: Date; durationS: number | null; volume: number; sets: number; topWeight: number; topReps: number };
  const sessions = new Map<number, Session>();
  for (const r of setRows) {
    const ts = r.startTs as Date;
    let s = sessions.get(r.activityId);
    if (!s) {
      s = { id: r.activityId, name: r.name, date: dayStr(ts), ts, durationS: r.durationS, volume: 0, sets: 0, topWeight: 0, topReps: 0 };
      sessions.set(r.activityId, s);
    }
    s.volume += r.volumeKg ?? 0;
    s.sets += 1;
    if ((r.weightKg ?? 0) > s.topWeight) {
      s.topWeight = r.weightKg ?? 0;
      s.topReps = r.reps ?? 0;
    }
  }
  const sessionList = [...sessions.values()].sort((a, b) => a.ts.getTime() - b.ts.getTime());

  const volumeBySession = sessionList.map((s) => ({ date: s.date, v: Math.round(s.volume) }));
  const setsBySession = sessionList.map((s) => ({ date: s.date, v: s.sets }));
  const topSetBySession = sessionList.filter((s) => s.topWeight > 0).map((s) => ({ date: s.date, v: s.topWeight }));

  const weekAgo = daysAgo(7);
  const weekRows = setRows.filter((r) => (r.startTs as Date) >= weekAgo);
  const weeklyVolumeKg = Math.round(weekRows.reduce((a, r) => a + (r.volumeKg ?? 0), 0));
  const weeklySets = weekRows.length;

  // Best set in the window.
  let topSet: { weightKg: number; reps: number } | null = null;
  for (const r of setRows) {
    if (r.weightKg != null && (topSet == null || r.weightKg > topSet.weightKg)) {
      topSet = { weightKg: r.weightKg, reps: r.reps ?? 0 };
    }
  }

  // Volume by muscle (last 7 days).
  const muscleVol = new Map<string, number>();
  for (const r of weekRows) {
    const g = muscleGroup(r.category, r.exercise);
    if (!g) continue;
    muscleVol.set(g, (muscleVol.get(g) ?? 0) + (r.volumeKg ?? 0));
  }
  const volumeByMuscle = [...muscleVol.entries()]
    .map(([group, kg]) => ({ group, kg: Math.round(kg) }))
    .sort((a, b) => b.kg - a.kg);

  // Last session — volume by lift.
  const last = sessionList.at(-1)!;
  const liftVol = new Map<string, number>();
  for (const r of setRows) {
    if (r.activityId !== last.id) continue;
    const name = (r.exercise ?? r.category ?? "Exercise").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    liftVol.set(name, (liftVol.get(name) ?? 0) + (r.volumeKg ?? 0));
  }
  const lastSession = {
    name: last.name,
    durationS: last.durationS,
    byLift: [...liftVol.entries()].map(([exercise, kg]) => ({ exercise, kg: Math.round(kg) })).sort((a, b) => b.kg - a.kg),
  };

  // Muscle heat-map: days since last trained + normalized recent volume per group.
  const lastTrained = new Map<string, Date>();
  for (const r of setRows) {
    const g = muscleGroup(r.category, r.exercise);
    if (!g) continue;
    const ts = r.startTs as Date;
    const cur = lastTrained.get(g);
    if (!cur || ts > cur) lastTrained.set(g, ts);
  }
  const maxMuscleVol = Math.max(1, ...volumeByMuscle.map((m) => m.kg));
  const now = Date.now();
  const muscles = MUSCLE_GROUPS.map((g) => {
    const lt = lastTrained.get(g);
    const days = lt ? Math.max(0, (now - lt.getTime()) / 86_400_000) : 7;
    const vol = (muscleVol.get(g) ?? 0) / maxMuscleVol; // 0..1
    return { group: g, days: Math.round(days * 10) / 10, vol: Math.round(vol * 100) / 100 };
  });

  return {
    hasData: true,
    readinessScore: lastDaily?.readiness_score ?? null,
    readinessSeries,
    volumeBySession,
    setsBySession,
    topSetBySession,
    acwrByDay,
    weeklyVolumeKg,
    weeklySets,
    topSet,
    acwr: {
      acute: lastLoad?.training_load_acute ?? null,
      chronic: lastLoad?.training_load_chronic ?? null,
      ratio:
        lastLoad && lastLoad.training_load_chronic
          ? (lastLoad.training_load_acute as number) / (lastLoad.training_load_chronic as number)
          : null,
    },
    volumeByMuscle,
    lastSession,
    muscles,
  };
}
