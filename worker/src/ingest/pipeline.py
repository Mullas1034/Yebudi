"""Orchestration: fetch -> land raw -> upsert curated.

Network I/O happens OUTSIDE any DB transaction; all writes for a day then commit in
a single transaction, so each day is all-or-nothing. The sync_log row is opened in
its own committed transaction first, so a failure is still recorded.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy.engine import Engine

from .db.curated import (
    upsert_activity,
    upsert_daily_summary,
    upsert_metric_samples,
    upsert_sleep,
)
from .db.raw import land_raw
from .db.sync import finish_sync, start_sync
from .sources.base import GarminSource


@dataclass(frozen=True, slots=True)
class SyncResult:
    sync_id: int
    status: str
    records_raw: int
    records_curated: int


def run_daily_sync(source: GarminSource, engine: Engine, day: date) -> SyncResult:
    with engine.begin() as conn:
        sync_id = start_sync(conn, source.source_id, "daily", day, day)
    try:
        bundle = source.fetch_daily(day)
        with engine.begin() as conn:
            raw_n = land_raw(conn, sync_id, source.source_id, bundle.raw)
            cur_n = 0
            if bundle.summary is not None:
                cur_n += upsert_daily_summary(conn, bundle.summary)
            cur_n += upsert_metric_samples(conn, bundle.metrics)
            if bundle.sleep is not None:
                cur_n += upsert_sleep(conn, bundle.sleep)
            for activity in bundle.activities:
                cur_n += upsert_activity(conn, activity)
            finish_sync(conn, sync_id, "success", records_raw=raw_n, records_curated=cur_n)
        return SyncResult(sync_id, "success", raw_n, cur_n)
    except Exception as exc:  # noqa: BLE001 — persist failure, then re-raise
        with engine.begin() as conn:
            finish_sync(conn, sync_id, "failed", error=repr(exc))
        raise


def run_activity_sync(source: GarminSource, engine: Engine, external_id: str) -> SyncResult:
    with engine.begin() as conn:
        sync_id = start_sync(conn, source.source_id, "activity")
    try:
        bundle = source.fetch_activity(external_id)
        with engine.begin() as conn:
            raw_n = land_raw(conn, sync_id, source.source_id, bundle.raw)
            cur_n = upsert_activity(conn, bundle)
            finish_sync(conn, sync_id, "success", records_raw=raw_n, records_curated=cur_n)
        return SyncResult(sync_id, "success", raw_n, cur_n)
    except Exception as exc:  # noqa: BLE001
        with engine.begin() as conn:
            finish_sync(conn, sync_id, "failed", error=repr(exc))
        raise


def run_backfill(
    source: GarminSource, engine: Engine, start: date, end: date
) -> list[SyncResult]:
    results: list[SyncResult] = []
    day = start
    while day <= end:
        results.append(run_daily_sync(source, engine, day))
        day += timedelta(days=1)
    return results
