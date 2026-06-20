from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date
from typing import ClassVar

from ..domain import ActivityBundle, DailyBundle


class GarminSource(ABC):
    """Adapter interface that hides *how* data is obtained.

    The pipeline depends only on this contract — it never imports a vendor library.
    Swapping python-garminconnect for the official API or FIT-file parsing means
    writing a new subclass; nothing downstream changes.

    Implementations MUST:
      * return tz-aware UTC datetimes in every DTO;
      * include the untouched source payload(s) as RawRecord(s), so the raw zone
        stays complete and the curated zone is always rebuildable;
      * be side-effect free — fetch + map only, no DB writes, no global state;
      * be safe to call repeatedly for the same day/activity (read-only).
    """

    #: stable identifier persisted to raw.sync_log / raw.garmin_response
    source_id: ClassVar[str]

    @abstractmethod
    def health_check(self) -> bool:
        """Return True if the source is reachable and authenticated."""

    @abstractmethod
    def fetch_daily(self, day: date) -> DailyBundle:
        """Pull everything for one calendar day: the daily summary, metric streams
        (HR/HRV/stress/...), and the sleep session. Heavy per-activity streams are
        fetched separately via fetch_activity."""

    @abstractmethod
    def list_activities(self, start: date, end: date) -> list[str]:
        """Return external activity ids recorded in [start, end] (inclusive)."""

    @abstractmethod
    def fetch_activity(self, external_id: str) -> ActivityBundle:
        """Pull a single activity in full: header, strength sets, HR-zone aggregates,
        and the per-second sample stream (for Game Day analysis)."""
