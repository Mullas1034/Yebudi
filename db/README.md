# Database

PostgreSQL 16 + TimescaleDB. Two schemas:

- **`raw`** — append-only landing zone. `garmin_response` stores untouched payloads;
  `sync_log` records every sync run. We never mutate raw data; the curated zone is
  always rebuildable by replaying it.
- **`curated`** — normalized, query-optimized tables the app reads. Every table has a
  natural key so the worker can upsert idempotently (see `worker/`).

## Tables

| Table | Purpose | Upsert key |
|-------|---------|------------|
| `raw.sync_log` | one row per sync run | — |
| `raw.garmin_response` | append-only payloads | `(source, endpoint, target_date, payload_hash)` |
| `curated.metric_sample` | **hypertable** — HR/HRV/stress/etc. time series | `(metric, ts)` |
| `curated.daily_summary` | cloud-computed daily scores | `day` |
| `curated.sleep_session` | nightly sleep summary | `day` |
| `curated.sleep_stage` | hypnogram segments | `(session_id, start_ts)` |
| `curated.activity` | header for all sessions | `external_id` |
| `curated.strength_set` | S&C per-set volume | `(activity_id, set_index)` |
| `curated.activity_zone` | HR zone aggregates | `(activity_id, zone)` |
| `curated.activity_sample` | per-second stream | `(activity_id, ts)` |

## Applying migrations

Plain SQL files, ordered by prefix. Apply with whatever you like:

```bash
# psql
psql "$DATABASE_URL_NODE" -f db/migrations/0001_init.sql

# or, with Docker running the compose stack (auto-applied on FIRST init only):
docker compose up -d
```

Migrations use `IF NOT EXISTS` throughout, so re-running `0001` is safe. For a real
migration history later, adopt a runner (Alembic from the Python side, or
`node-pg-migrate`/`dbmate`) — but keep the files as plain, reviewable SQL.
