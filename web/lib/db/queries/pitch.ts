import "server-only";

import { sql } from "kysely";

import { getDb } from "@/lib/db/client";
import { getReadinessFactors } from "@/lib/db/queries/pulse";
import type { Factor } from "@/lib/pulse-types";

const SPORT_MATCH = "%hockey%"; // primary game-day sport (deferred schedule → main sport)

export interface SeriesPoint {
  date: string;
  v: number;
}

export interface PitchData {
  hasData: boolean;
  game: {
    name: string | null;
    date: string;
    distanceKm: number | null;
    avgHr: number | null;
    maxHr: number | null;
    durationS: number | null;
    topSpeedKmh: number | null;
    highSpeedMin: number | null;
  } | null;
  readinessScore: number | null;
  readinessSeries: SeriesPoint[];
  factors: Factor[];
  distanceSeries: SeriesPoint[];
  topSpeedSeries: SeriesPoint[];
  highSpeedSeries: SeriesPoint[];
  avgHrSeries: SeriesPoint[];
  speedBands: { label: string; meters: number }[];
  hrZones: { zone: number; seconds: number }[];
  timeAbove85Min: number | null;
  gps: { path: [number, number][]; sprints: [number, number][][]; distanceKm: number | null } | null;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function dayStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getPitch(): Promise<PitchData> {
  const curated = getDb().withSchema("curated");
  const cutoff = daysAgo(30);

  // Hockey games in the window (headers) + per-game speed aggregates.
  const [games, speedAgg, dailyRows] = await Promise.all([
    curated
      .selectFrom("activity")
      .select(["id", "name", "start_ts", "distance_m", "avg_hr", "max_hr", "duration_s"])
      .where("sport", "ilike", SPORT_MATCH)
      .where("start_ts", ">=", cutoff)
      .orderBy("start_ts", "asc")
      .execute(),
    curated
      .selectFrom("activity_sample as s")
      .innerJoin("activity as a", "a.id", "s.activity_id")
      .select([
        "a.id as id",
        sql<number>`max(s.speed_mps)`.as("topSpeed"),
        sql<number>`coalesce(sum(case when s.speed_mps * 3.6 >= 19 then 1 else 0 end), 0)`.as("highSeconds"),
      ])
      .where("a.sport", "ilike", SPORT_MATCH)
      .where("a.start_ts", ">=", cutoff)
      .groupBy("a.id")
      .execute(),
    curated
      .selectFrom("daily_summary")
      .select(["day", "readiness_score"])
      .where("day", ">=", dayStr(cutoff))
      .orderBy("day", "asc")
      .execute(),
  ]);

  const readinessSeries: SeriesPoint[] = dailyRows
    .filter((r) => r.readiness_score != null)
    .map((r) => ({ date: r.day, v: r.readiness_score as number }));
  const readinessScore = dailyRows.filter((r) => r.readiness_score != null).at(-1)?.readiness_score ?? null;

  if (games.length === 0) {
    return {
      hasData: false,
      game: null,
      readinessScore,
      readinessSeries,
      factors: [],
      distanceSeries: [],
      topSpeedSeries: [],
      highSpeedSeries: [],
      avgHrSeries: [],
      speedBands: [],
      hrZones: [],
      timeAbove85Min: null,
      gps: null,
    };
  }

  const speedById = new Map(speedAgg.map((s) => [s.id, s]));
  const distanceSeries: SeriesPoint[] = [];
  const topSpeedSeries: SeriesPoint[] = [];
  const highSpeedSeries: SeriesPoint[] = [];
  const avgHrSeries: SeriesPoint[] = [];
  for (const g of games) {
    const date = dayStr(g.start_ts as Date);
    if (g.distance_m != null) distanceSeries.push({ date, v: Math.round((g.distance_m / 1000) * 10) / 10 });
    if (g.avg_hr != null) avgHrSeries.push({ date, v: g.avg_hr });
    const sp = speedById.get(g.id);
    if (sp?.topSpeed != null) topSpeedSeries.push({ date, v: Math.round(sp.topSpeed * 3.6 * 10) / 10 });
    if (sp?.highSeconds != null) highSpeedSeries.push({ date, v: Math.round((sp.highSeconds / 60) * 10) / 10 });
  }

  // The session = most recent game.
  const game = games.at(-1)!;
  const sp = speedById.get(game.id);

  const [samples, zones, factors] = await Promise.all([
    curated
      .selectFrom("activity_sample")
      .select(["elapsed_s", "hr", "speed_mps", "lat", "lon"])
      .where("activity_id", "=", game.id)
      .orderBy("elapsed_s", "asc")
      .execute(),
    curated
      .selectFrom("activity_zone")
      .select(["zone", "seconds_in"])
      .where("activity_id", "=", game.id)
      .orderBy("zone", "asc")
      .execute(),
    getReadinessFactors(dayStr(game.start_ts as Date)),
  ]);

  // Speed bands (distance per band) + time>85% max HR, from session samples.
  const bands = [
    { label: ">23 km/h", min: 23, max: Infinity, meters: 0 },
    { label: "19–23", min: 19, max: 23, meters: 0 },
    { label: "15–19", min: 15, max: 19, meters: 0 },
    { label: "<15", min: 0, max: 15, meters: 0 },
  ];
  const hrThreshold = game.max_hr != null ? 0.85 * game.max_hr : null;
  let above85 = 0;
  let prevEl: number | null = null;
  for (const s of samples) {
    const el = s.elapsed_s ?? null;
    const dt = prevEl != null && el != null ? Math.max(0, Math.min(5, el - prevEl)) : 1;
    prevEl = el;
    if (s.speed_mps != null) {
      const kmh = s.speed_mps * 3.6;
      const b = bands.find((x) => kmh >= x.min && kmh < x.max);
      if (b) b.meters += s.speed_mps * dt;
    }
    if (hrThreshold != null && s.hr != null && s.hr >= hrThreshold) above85 += dt;
  }

  // GPS path (normalised 0..1) + sprint segments (>=23 km/h runs).
  const geo = samples.filter((s) => s.lat != null && s.lon != null) as { lat: number; lon: number; speed_mps: number | null }[];
  let gps: PitchData["gps"] = null;
  if (geo.length >= 2) {
    const lats = geo.map((g) => g.lat);
    const lons = geo.map((g) => g.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const rLat = maxLat - minLat || 1, rLon = maxLon - minLon || 1;
    const norm = (g: { lat: number; lon: number }): [number, number] => [(g.lon - minLon) / rLon, 1 - (g.lat - minLat) / rLat];

    const step = Math.max(1, Math.floor(geo.length / 150));
    const path: [number, number][] = geo.filter((_, i) => i % step === 0).map(norm);

    const sprints: [number, number][][] = [];
    let cur: [number, number][] = [];
    for (const g of geo) {
      const fast = g.speed_mps != null && g.speed_mps * 3.6 >= 23;
      if (fast) cur.push(norm(g));
      else if (cur.length >= 3) {
        sprints.push(cur);
        cur = [];
      } else cur = [];
    }
    if (cur.length >= 3) sprints.push(cur);

    gps = { path, sprints: sprints.slice(0, 6), distanceKm: game.distance_m != null ? Math.round((game.distance_m / 1000) * 10) / 10 : null };
  }

  return {
    hasData: true,
    game: {
      name: game.name,
      date: dayStr(game.start_ts as Date),
      distanceKm: game.distance_m != null ? Math.round((game.distance_m / 1000) * 10) / 10 : null,
      avgHr: game.avg_hr,
      maxHr: game.max_hr,
      durationS: game.duration_s,
      topSpeedKmh: sp?.topSpeed != null ? Math.round(sp.topSpeed * 3.6 * 10) / 10 : null,
      highSpeedMin: sp?.highSeconds != null ? Math.round((sp.highSeconds / 60) * 10) / 10 : null,
    },
    readinessScore,
    readinessSeries,
    factors,
    distanceSeries,
    topSpeedSeries,
    highSpeedSeries,
    avgHrSeries,
    speedBands: bands.map((b) => ({ label: b.label, meters: Math.round(b.meters) })),
    hrZones: zones.map((z) => ({ zone: z.zone, seconds: z.seconds_in })),
    timeAbove85Min: hrThreshold != null ? Math.round((above85 / 60) * 10) / 10 : null,
    gps,
  };
}
