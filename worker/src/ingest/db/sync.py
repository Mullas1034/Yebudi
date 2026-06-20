from __future__ import annotations

from datetime import date

from sqlalchemy import text
from sqlalchemy.engine import Connection


def start_sync(
    conn: Connection,
    source: str,
    sync_type: str,
    range_start: date | None = None,
    range_end: date | None = None,
) -> int:
    """Open a sync_log row in 'running' state; return its id."""
    return conn.execute(
        text(
            """
            INSERT INTO raw.sync_log (source, sync_type, range_start, range_end, status)
            VALUES (:source, :sync_type, :range_start, :range_end, 'running')
            RETURNING id
            """
        ),
        {
            "source": source,
            "sync_type": sync_type,
            "range_start": range_start,
            "range_end": range_end,
        },
    ).scalar_one()


def finish_sync(
    conn: Connection,
    sync_id: int,
    status: str,
    *,
    records_raw: int = 0,
    records_curated: int = 0,
    error: str | None = None,
) -> None:
    """Close a sync_log row with a terminal status and counts."""
    conn.execute(
        text(
            """
            UPDATE raw.sync_log
               SET status = :status,
                   finished_at = now(),
                   records_raw = :records_raw,
                   records_curated = :records_curated,
                   error = :error
             WHERE id = :sync_id
            """
        ),
        {
            "status": status,
            "records_raw": records_raw,
            "records_curated": records_curated,
            "error": error,
            "sync_id": sync_id,
        },
    )
