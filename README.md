# Garmin Insights

Self-hosted, mobile-first app that ingests Garmin wearable data and turns raw
physiology into actionable insight across three pillars:

1. **Day-to-Day Trends** — readiness, HRV, body battery, sleep, stress
2. **Strength & Conditioning** — per-set volume tracking
3. **Training / Game Days** — HR zones and per-second streams per session

## Philosophy

- **Raw-first ingestion.** Every payload lands untouched in an append-only table.
  The curated, query-optimized tables are derived from it with idempotent upserts,
  so the curated zone is always rebuildable and re-syncs never duplicate data.
- **Source-agnostic.** Extraction sits behind a `GarminSource` adapter. The rest of
  the system never knows whether data came from `python-garminconnect`, the official
  API, or FIT files.
- **Mobile-first, progressive disclosure.** Top-level insight at a glance; tap to
  drill into detail.

## Architecture

```
            ┌──────────────┐   adapter    ┌───────────────────────────┐
 Garmin ───▶│ GarminSource │─────────────▶│ worker (Python/SQLAlchemy)│
            └──────────────┘  DTOs+raw     └─────────────┬─────────────┘
                                                         │ raw-first, idempotent
                                       ┌─────────────────▼─────────────────┐
                                       │ Postgres + TimescaleDB            │
                                       │  raw.*      (append-only landing) │
                                       │  curated.*  (scores, series, …)   │
                                       └─────────────────┬─────────────────┘
                                                         │ reads
                                              ┌──────────▼──────────┐
                                              │ web (Next.js)       │
                                              │ Morning Readiness   │
                                              └─────────────────────┘
```

## Layout

```
db/        SQL migrations (raw + curated schema, TimescaleDB hypertable)
worker/    Python ingestion worker (adapter, idempotent upserts, pipeline)
web/       Next.js mobile dashboard (Morning Readiness view)
docker-compose.yml   local TimescaleDB
```

## Stack

| Layer      | Choice |
|------------|--------|
| Web / API  | Next.js 15 (App Router), TypeScript, Tailwind, shadcn-style UI |
| Ingestion  | Python 3.11+, SQLAlchemy 2.0 Core + psycopg 3 |
| Database   | PostgreSQL 16 + TimescaleDB |

## Quickstart

```bash
# 1. Database (Docker) — or point DATABASE_URL at any Postgres 16 + TimescaleDB
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
docker compose up -d
psql "$DATABASE_URL_NODE" -f db/migrations/0001_init.sql   # if not auto-applied

# 2. Worker
cd worker && python -m venv .venv && .venv\Scripts\Activate.ps1
pip install -e ".[dev]"
garmin-ingest daily --date 2026-06-19    # (adapter calls are stubbed for now)

# 3. Web
cd web && npm install && npm run dev      # http://localhost:3000
```

## Status

Foundation only (4 steps):

- [x] Project structure + stack
- [x] Database schema (raw landing, sync log, curated zone, hypertable)
- [x] `GarminSource` adapter interface + idempotent upsert logic (vendor impl stubbed)
- [x] Morning Readiness dashboard (mobile, mock data)

**Next:** implement the `garminconnect` adapter mapping; add a typed DB query layer
(Kysely/Drizzle) to replace the dashboard's mock data; build the S&C and Game Day views.
