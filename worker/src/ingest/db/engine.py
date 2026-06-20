from __future__ import annotations

from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine


@lru_cache(maxsize=1)
def get_engine(database_url: str) -> Engine:
    """Process-wide SQLAlchemy engine. `pool_pre_ping` survives idle DB drops."""
    return create_engine(database_url, pool_pre_ping=True, future=True)
