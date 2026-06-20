"""Map normalized DTOs onto curated tables via the idempotent upsert helpers.

Every function here is safe to run repeatedly with the same input — that's the whole
point of the curated zone. Generated columns (sleep_session.duration_s,
strength_set.volume_kg) are intentionally absent from the DTOs, so they're never in
an INSERT column list.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import asdict

from sqlalchemy.engine import Connection

from ..domain import ActivityBundle, DailySummaryDTO, MetricSampleDTO, SleepBundle
from .upsert import replace_children, upsert_many, upsert_one


def upsert_daily_summary(conn: Connection, dto: DailySummaryDTO) -> int:
    return upsert_many(conn, "curated.daily_summary", [asdict(dto)], conflict=["day"])


def upsert_metric_samples(conn: Connection, samples: Sequence[MetricSampleDTO]) -> int:
    rows = [{"ts": s.ts, "metric": str(s.metric), "value": float(s.value)} for s in samples]
    return upsert_many(conn, "curated.metric_sample", rows, conflict=["metric", "ts"])


def upsert_sleep(conn: Connection, bundle: SleepBundle) -> int:
    session_id = upsert_one(
        conn, "curated.sleep_session", asdict(bundle.session), conflict=["day"]
    )
    stage_rows = [
        {
            "session_id": session_id,
            "start_ts": s.start_ts,
            "end_ts": s.end_ts,
            "stage": str(s.stage),
        }
        for s in bundle.stages
    ]
    replace_children(conn, "curated.sleep_stage", "session_id", session_id, stage_rows)
    return 1


def upsert_activity(conn: Connection, bundle: ActivityBundle) -> int:
    activity_id = upsert_one(
        conn, "curated.activity", asdict(bundle.activity), conflict=["external_id"]
    )

    if bundle.strength_sets:
        rows = [{"activity_id": activity_id, **asdict(s)} for s in bundle.strength_sets]
        replace_children(conn, "curated.strength_set", "activity_id", activity_id, rows)
    if bundle.zones:
        rows = [{"activity_id": activity_id, **asdict(z)} for z in bundle.zones]
        replace_children(conn, "curated.activity_zone", "activity_id", activity_id, rows)
    if bundle.samples:
        rows = [{"activity_id": activity_id, **asdict(s)} for s in bundle.samples]
        replace_children(conn, "curated.activity_sample", "activity_id", activity_id, rows)
    return 1
