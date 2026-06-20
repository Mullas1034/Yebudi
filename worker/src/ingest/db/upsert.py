"""Generic idempotent upsert helpers built on Postgres ``INSERT ... ON CONFLICT``.

Identifiers (table/column names) are developer-controlled constants from the curated
mapping layer, never user input — but they're validated anyway so this stays safe if
that ever changes. Row *values* always go through bound parameters.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Connection

_IDENT = re.compile(r"[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?")


def _ident(name: str) -> str:
    if not _IDENT.fullmatch(name):
        raise ValueError(f"unsafe SQL identifier: {name!r}")
    return name


def _value(col: str, casts: Mapping[str, str]) -> str:
    return f"CAST(:{col} AS {casts[col]})" if col in casts else f":{col}"


def upsert_many(
    conn: Connection,
    table: str,
    rows: Sequence[Mapping[str, Any]],
    *,
    conflict: Sequence[str],
    update: Sequence[str] | None = None,
    casts: Mapping[str, str] | None = None,
) -> int:
    """Bulk ``INSERT ... ON CONFLICT DO UPDATE`` for rows with no surrogate id we
    need back.

    Re-applying identical data is a no-op: the ``WHERE ... IS DISTINCT FROM`` guard
    skips writes when nothing changed, so we don't churn dead tuples on the hot,
    high-volume path (e.g. metric samples). Returns rows processed.
    """
    rows = [r for r in rows if r is not None]
    if not rows:
        return 0

    table = _ident(table)
    casts = casts or {}
    cols = [_ident(c) for c in rows[0]]
    conflict = [_ident(c) for c in conflict]
    update = [_ident(c) for c in (update if update is not None else [c for c in cols if c not in conflict])]

    col_list = ", ".join(cols)
    val_list = ", ".join(_value(c, casts) for c in cols)
    conflict_list = ", ".join(conflict)

    if update:
        set_list = ", ".join(f"{c} = EXCLUDED.{c}" for c in update)
        lhs = ", ".join(f"t.{c}" for c in update)
        rhs = ", ".join(f"EXCLUDED.{c}" for c in update)
        action = f"DO UPDATE SET {set_list} WHERE ({lhs}) IS DISTINCT FROM ({rhs})"
    else:
        action = "DO NOTHING"

    sql = (
        f"INSERT INTO {table} AS t ({col_list}) VALUES ({val_list}) "
        f"ON CONFLICT ({conflict_list}) {action}"
    )
    conn.execute(text(sql), list(rows))
    return len(rows)


def upsert_one(
    conn: Connection,
    table: str,
    row: Mapping[str, Any],
    *,
    conflict: Sequence[str],
    update: Sequence[str] | None = None,
    casts: Mapping[str, str] | None = None,
    returning: str = "id",
) -> Any:
    """Upsert one header row and return a column (default: the surrogate ``id``).

    Always runs ``DO UPDATE`` (no skip-unchanged guard) so ``RETURNING`` yields the
    id even when the row is unchanged. Intended for low-cardinality parents — one
    per day, one per activity — where an occasional no-op write is cheap.
    """
    table = _ident(table)
    casts = casts or {}
    cols = [_ident(c) for c in row]
    conflict = [_ident(c) for c in conflict]
    returning = _ident(returning)
    update = [_ident(c) for c in (update if update is not None else [c for c in cols if c not in conflict])]

    col_list = ", ".join(cols)
    val_list = ", ".join(_value(c, casts) for c in cols)
    conflict_list = ", ".join(conflict)
    set_list = (
        ", ".join(f"{c} = EXCLUDED.{c}" for c in update)
        if update
        else f"{conflict[0]} = EXCLUDED.{conflict[0]}"  # no-op set, guarantees a returned row
    )

    sql = (
        f"INSERT INTO {table} AS t ({col_list}) VALUES ({val_list}) "
        f"ON CONFLICT ({conflict_list}) DO UPDATE SET {set_list} "
        f"RETURNING {returning}"
    )
    return conn.execute(text(sql), dict(row)).scalar_one()


def replace_children(
    conn: Connection,
    table: str,
    parent_col: str,
    parent_id: Any,
    rows: Sequence[Mapping[str, Any]],
    *,
    casts: Mapping[str, str] | None = None,
) -> int:
    """Replace all child rows for a parent (delete-then-insert), within the caller's
    transaction.

    Correct and idempotent for collections owned wholesale by a parent and
    re-delivered in full each sync: hypnogram stages, HR zones, per-second samples,
    strength sets.
    """
    table = _ident(table)
    parent_col = _ident(parent_col)
    conn.execute(text(f"DELETE FROM {table} WHERE {parent_col} = :pid"), {"pid": parent_id})

    rows = [r for r in rows if r is not None]
    if not rows:
        return 0
    casts = casts or {}
    cols = [_ident(c) for c in rows[0]]
    col_list = ", ".join(cols)
    val_list = ", ".join(_value(c, casts) for c in cols)
    conn.execute(text(f"INSERT INTO {table} ({col_list}) VALUES ({val_list})"), list(rows))
    return len(rows)
