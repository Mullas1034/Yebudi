# Ingestion worker

Pulls Garmin data through a swappable adapter, lands the untouched payloads in the
`raw` zone, then upserts normalized rows into the `curated` zone — idempotently.

```
sources/base.py        GarminSource — the adapter contract (the only thing the
                       pipeline depends on)
sources/garminconnect.py   concrete adapter (STUB) for the `garminconnect` library
domain.py              DTOs + bundles (the normalized shapes; vendor-agnostic)
db/upsert.py           generic idempotent upsert helpers (ON CONFLICT ...)
db/raw.py              append-only landing
db/curated.py          DTO -> curated table mapping
pipeline.py            fetch -> land raw -> upsert curated (atomic per day)
cli.py                 `garmin-ingest daily|backfill|activity`
```

## Why an adapter

`pipeline.py` imports `GarminSource`, never a vendor library. Switching from
`python-garminconnect` to the official API or to FIT-file parsing is a new subclass
registered in `sources/__init__.py` — nothing downstream changes.

## Setup

```bash
cd worker
python -m venv .venv && .venv\Scripts\activate    # PowerShell: .venv\Scripts\Activate.ps1
pip install -e ".[dev]"

# from repo root, with .env populated and the DB migrated:
garmin-ingest daily --date 2026-06-19
garmin-ingest backfill --start 2026-06-01 --end 2026-06-19
garmin-ingest activity --id 1234567890
```

Schedule `daily` with cron / Task Scheduler / a systemd timer. The concrete
`garminconnect` calls are stubbed (`NotImplementedError`) — see `sources/garminconnect.py`.
