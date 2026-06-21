// Hand-written Kysely interfaces for the tables the web app reads. Mirrors
// db/migrations/0001_init.sql. Table names are unqualified here; queries select the
// schema explicitly via db.withSchema('curated' | 'raw').

export interface DailySummaryTable {
  day: string; // DATE, kept as 'YYYY-MM-DD' (see client.ts type parser)
  readiness_score: number | null;
  readiness_status: string | null;
  hrv_status: string | null;
  hrv_last_night_ms: number | null;
  hrv_weekly_avg_ms: number | null;
  hrv_baseline_low_ms: number | null;
  hrv_baseline_high_ms: number | null;
  body_battery_high: number | null;
  body_battery_low: number | null;
  body_battery_morning: number | null;
  sleep_score: number | null;
  sleep_duration_s: number | null;
  resting_hr: number | null;
  stress_avg: number | null;
  training_load_acute: number | null;
  training_load_chronic: number | null;
  training_readiness: number | null;
  computed_at: Date;
}

export interface SleepSessionTable {
  id: number;
  day: string;
  start_ts: Date;
  end_ts: Date;
  duration_s: number | null;
  sleep_score: number | null;
  deep_s: number | null;
  light_s: number | null;
  rem_s: number | null;
  awake_s: number | null;
  avg_hrv_ms: number | null;
  avg_spo2: number | null;
  avg_respiration: number | null;
  resting_hr: number | null;
}

export interface GarminResponseTable {
  id: number;
  source: string;
  endpoint: string;
  target_date: string | null;
  external_id: string | null;
  payload: unknown; // JSONB — parsed object/array
  payload_hash: string;
  sync_id: number | null;
  fetched_at: Date;
}

export interface DB {
  daily_summary: DailySummaryTable; // curated
  sleep_session: SleepSessionTable; // curated
  garmin_response: GarminResponseTable; // raw
}
