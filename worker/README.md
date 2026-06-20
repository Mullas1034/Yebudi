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

## Authentication (token-based)

The `python-garminconnect` adapter **resumes from cached Garth tokens** — no credentials
or MFA on the sync path. Put tokens in the tokenstore dir (`GARMINTOKENS`, mounted at
`/tokens` in Docker via `./.garmin_tokens`). Generate them once, either:

- in-container: `docker compose run --rm -it worker login` (prompts email/password/MFA), or
- on any machine: `python -c "import garth; garth.login('EMAIL','PASSWORD'); garth.save('./.garmin_tokens')"`,
  then copy `./.garmin_tokens/` to the server.

Tokens auto-refresh, so `daily` / `backfill` / `activity` then need no credentials.
Schedule `daily` with cron / a systemd timer (separate step).

> Mapping field names are validated against real payloads stored in `raw.garmin_response`;
> items marked `VERIFY` in `sources/garmin_mapping.py` (sleep-stage levels, set weight unit,
> training load) should be sanity-checked against your first real sync.
