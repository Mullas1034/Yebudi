from __future__ import annotations

import hashlib
import json
from collections.abc import Sequence

from sqlalchemy import text
from sqlalchemy.engine import Connection

from ..domain import RawRecord

_INSERT = text(
    """
    INSERT INTO raw.garmin_response
        (source, endpoint, target_date, external_id, payload, payload_hash, sync_id)
    VALUES
        (:source, :endpoint, :target_date, :external_id,
         CAST(:payload AS JSONB), :payload_hash, :sync_id)
    ON CONFLICT ON CONSTRAINT garmin_response_dedupe DO NOTHING
    """
)


def _canonical(payload: object) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def land_raw(conn: Connection, sync_id: int, source: str, records: Sequence[RawRecord]) -> int:
    """Append untouched payloads to raw.garmin_response (append-only).

    Idempotent via the (source, endpoint, target_date, payload_hash) unique index:
    identical re-fetches DO NOTHING; revised data lands as a new row. Returns the
    number of payloads processed.
    """
    if not records:
        return 0
    params = []
    for r in records:
        body = _canonical(r.payload)
        params.append(
            {
                "source": source,
                "endpoint": r.endpoint,
                "target_date": r.target_date,
                "external_id": r.external_id,
                "payload": body,
                "payload_hash": hashlib.sha256(body.encode()).hexdigest(),
                "sync_id": sync_id,
            }
        )
    conn.execute(_INSERT, params)
    return len(params)
