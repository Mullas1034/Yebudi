-- 0001_init.sql
-- Foundation schema for the Garmin insights platform.
--
-- Two zones:
--   raw      append-only landing for untouched API/file payloads + a sync log
--   curated  normalized, query-optimized tables produced by idempotent upserts
--
-- The migration is safe to re-run (IF NOT EXISTS everywhere). Apply against a
-- Postgres 16 database that has the TimescaleDB extension available.

BEGIN;

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS curated;

-- ════════════════════════════════════════════════════════════════════════
-- RAW ZONE
-- ════════════════════════════════════════════════════════════════════════

-- One row per sync run. The worker opens a row before fetching and closes it
-- with a status afterwards, giving us an audit trail + idempotency anchor.
CREATE TABLE IF NOT EXISTS raw.sync_log (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source           TEXT        NOT NULL,                 -- adapter id, e.g. 'python-garminconnect'
    sync_type        TEXT        NOT NULL,                 -- 'daily' | 'backfill' | 'activity'
    range_start      DATE,
    range_end        DATE,
    status           TEXT        NOT NULL DEFAULT 'running'
                     CHECK (status IN ('running','success','partial','failed')),
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at      TIMESTAMPTZ,
    records_raw      INTEGER     NOT NULL DEFAULT 0,        -- payloads landed
    records_curated  INTEGER     NOT NULL DEFAULT 0,        -- curated rows touched
    error            TEXT,
    metadata         JSONB       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS sync_log_started_idx ON raw.sync_log (started_at DESC);

-- Append-only landing table. We never UPDATE here; we only INSERT. The curated
-- zone is always rebuildable by replaying these payloads.
CREATE TABLE IF NOT EXISTS raw.garmin_response (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source        TEXT        NOT NULL,
    endpoint      TEXT        NOT NULL,            -- logical endpoint: 'daily_summary','sleep','activity',...
    target_date   DATE,                            -- the day the payload pertains to (nullable)
    external_id   TEXT,                            -- e.g. Garmin activityId, when applicable
    payload       JSONB       NOT NULL,            -- untouched response
    payload_hash  TEXT        NOT NULL,            -- sha256 of canonical payload, for dedupe
    sync_id       BIGINT      REFERENCES raw.sync_log(id),
    fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Re-fetching identical data is a no-op; revised numbers (same day, new hash)
    -- land as a NEW row so history is preserved. NULLS NOT DISTINCT (PG15+) makes
    -- undated payloads dedupe too.
    CONSTRAINT garmin_response_dedupe
        UNIQUE NULLS NOT DISTINCT (source, endpoint, target_date, payload_hash)
);

CREATE INDEX IF NOT EXISTS garmin_response_lookup_idx
    ON raw.garmin_response (endpoint, target_date DESC);
CREATE INDEX IF NOT EXISTS garmin_response_payload_gin
    ON raw.garmin_response USING gin (payload jsonb_path_ops);

-- ════════════════════════════════════════════════════════════════════════
-- CURATED ZONE
-- ════════════════════════════════════════════════════════════════════════

-- ── Time-series spine ───────────────────────────────────────────────────
-- Long/narrow shape so any sampled physiological signal fits without schema
-- changes. Becomes a TimescaleDB hypertable below.
CREATE TABLE IF NOT EXISTS curated.metric_sample (
    ts      TIMESTAMPTZ      NOT NULL,
    metric  TEXT             NOT NULL,   -- 'heart_rate','hrv','stress','respiration','spo2','body_battery'
    value   DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (metric, ts)             -- partition column (ts) is included, as Timescale requires
);

SELECT create_hypertable(
    'curated.metric_sample', 'ts',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists       => TRUE
);

-- Compress older chunks; recent data stays row-oriented for fast writes/reads.
ALTER TABLE curated.metric_sample SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'metric',
    timescaledb.compress_orderby   = 'ts DESC'
);
SELECT add_compression_policy('curated.metric_sample', INTERVAL '14 days', if_not_exists => TRUE);

-- ── One row per calendar day: the cloud-computed scores ─────────────────
CREATE TABLE IF NOT EXISTS curated.daily_summary (
    day                    DATE PRIMARY KEY,

    -- Readiness
    readiness_score        SMALLINT CHECK (readiness_score BETWEEN 0 AND 100),
    readiness_status       TEXT,

    -- HRV
    hrv_status             TEXT,        -- 'balanced','unbalanced','low','poor','no_reading'
    hrv_last_night_ms      SMALLINT,
    hrv_weekly_avg_ms      SMALLINT,
    hrv_baseline_low_ms    SMALLINT,
    hrv_baseline_high_ms   SMALLINT,

    -- Body Battery
    body_battery_high      SMALLINT CHECK (body_battery_high BETWEEN 0 AND 100),
    body_battery_low       SMALLINT CHECK (body_battery_low  BETWEEN 0 AND 100),
    body_battery_morning   SMALLINT CHECK (body_battery_morning BETWEEN 0 AND 100),

    -- Sleep
    sleep_score            SMALLINT CHECK (sleep_score BETWEEN 0 AND 100),
    sleep_duration_s       INTEGER,

    -- Day-to-day vitals
    resting_hr             SMALLINT,
    stress_avg             SMALLINT,

    -- Training load (acute:chronic workload ratio inputs)
    training_load_acute    REAL,
    training_load_chronic  REAL,
    training_readiness     SMALLINT CHECK (training_readiness BETWEEN 0 AND 100),

    computed_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_sync_id         BIGINT REFERENCES raw.sync_log(id)
);

-- ── Sleep: nightly summary separated from the hypnogram ─────────────────
CREATE TABLE IF NOT EXISTS curated.sleep_session (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    day             DATE        NOT NULL,            -- the wake day this sleep belongs to
    start_ts        TIMESTAMPTZ NOT NULL,
    end_ts          TIMESTAMPTZ NOT NULL,
    duration_s      INTEGER GENERATED ALWAYS AS
                        (EXTRACT(EPOCH FROM (end_ts - start_ts))::int) STORED,
    sleep_score     SMALLINT CHECK (sleep_score BETWEEN 0 AND 100),
    deep_s          INTEGER,
    light_s         INTEGER,
    rem_s           INTEGER,
    awake_s         INTEGER,
    avg_hrv_ms      SMALLINT,
    avg_spo2        SMALLINT,
    avg_respiration REAL,
    resting_hr      SMALLINT,
    CONSTRAINT sleep_session_day_uniq UNIQUE (day)   -- main nightly sleep; naps are out of scope for now
);

CREATE INDEX IF NOT EXISTS sleep_session_start_idx ON curated.sleep_session (start_ts DESC);

-- The hypnogram: ordered stage segments for a session.
CREATE TABLE IF NOT EXISTS curated.sleep_stage (
    session_id  BIGINT      NOT NULL REFERENCES curated.sleep_session(id) ON DELETE CASCADE,
    start_ts    TIMESTAMPTZ NOT NULL,
    end_ts      TIMESTAMPTZ NOT NULL,
    stage       TEXT        NOT NULL CHECK (stage IN ('deep','light','rem','awake')),
    PRIMARY KEY (session_id, start_ts)
);

-- ── Activity header (all sessions: runs, lifts, games) ──────────────────
CREATE TABLE IF NOT EXISTS curated.activity (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    external_id    TEXT        NOT NULL UNIQUE,      -- Garmin activityId (natural upsert key)
    sport          TEXT        NOT NULL,            -- 'running','strength_training','basketball',...
    sub_sport      TEXT,
    name           TEXT,
    start_ts       TIMESTAMPTZ NOT NULL,
    end_ts         TIMESTAMPTZ,
    duration_s     INTEGER,
    moving_s       INTEGER,
    distance_m     REAL,
    calories       INTEGER,
    avg_hr         SMALLINT,
    max_hr         SMALLINT,
    training_load  REAL,
    aerobic_te     REAL,                            -- aerobic training effect
    anaerobic_te   REAL,                            -- anaerobic training effect
    rpe            SMALLINT,                         -- subjective rate of perceived exertion
    source_sync_id BIGINT REFERENCES raw.sync_log(id)
);

CREATE INDEX IF NOT EXISTS activity_start_idx ON curated.activity (start_ts DESC);
CREATE INDEX IF NOT EXISTS activity_sport_idx ON curated.activity (sport, start_ts DESC);

-- ── Strength & Conditioning: per-set volume tracking ────────────────────
CREATE TABLE IF NOT EXISTS curated.strength_set (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    activity_id       BIGINT   NOT NULL REFERENCES curated.activity(id) ON DELETE CASCADE,
    set_index         SMALLINT NOT NULL,            -- order within the workout
    exercise          TEXT,                          -- normalized name, e.g. 'back_squat'
    exercise_category TEXT,                          -- Garmin category, e.g. 'SQUAT'
    reps              SMALLINT,
    weight_kg         REAL,
    volume_kg         REAL GENERATED ALWAYS AS (reps * weight_kg) STORED,
    rest_s            INTEGER,
    start_ts          TIMESTAMPTZ,
    duration_s        INTEGER,
    CONSTRAINT strength_set_uniq UNIQUE (activity_id, set_index)
);

-- ── Game Days: HR zone aggregates + per-second stream ───────────────────
CREATE TABLE IF NOT EXISTS curated.activity_zone (
    activity_id  BIGINT   NOT NULL REFERENCES curated.activity(id) ON DELETE CASCADE,
    zone         SMALLINT NOT NULL CHECK (zone BETWEEN 0 AND 5),
    seconds_in   INTEGER  NOT NULL,
    low_bpm      SMALLINT,
    high_bpm     SMALLINT,
    PRIMARY KEY (activity_id, zone)
);

CREATE TABLE IF NOT EXISTS curated.activity_sample (
    activity_id  BIGINT      NOT NULL REFERENCES curated.activity(id) ON DELETE CASCADE,
    ts           TIMESTAMPTZ NOT NULL,
    elapsed_s    INTEGER,
    hr           SMALLINT,
    speed_mps    REAL,
    cadence      SMALLINT,
    power_w      SMALLINT,
    altitude_m   REAL,
    lat          DOUBLE PRECISION,
    lon          DOUBLE PRECISION,
    PRIMARY KEY (activity_id, ts)
    -- High volume but always queried per-activity, so a plain table is fine.
    -- Convert to a hypertable on `ts` if cross-activity time scans ever matter.
);

COMMIT;
