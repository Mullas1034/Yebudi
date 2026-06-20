from __future__ import annotations

from datetime import date
from typing import ClassVar

from ..domain import ActivityBundle, DailyBundle
from .base import GarminSource


class GarminConnectSource(GarminSource):
    """Adapter backed by the unofficial ``garminconnect`` library.

    STUB: the interface and contracts are settled; the actual library calls and the
    payload -> DTO mapping are intentionally left to implement. Each method documents
    exactly which endpoints feed which DTOs so the wiring is mechanical.
    """

    source_id: ClassVar[str] = "python-garminconnect"

    def __init__(
        self,
        email: str | None,
        password: str | None,
        token_store: str | None = None,
    ) -> None:
        self._email = email
        self._password = password
        self._token_store = token_store
        self._client = None  # created lazily in _connect()

    def _connect(self):
        """Create + authenticate the client, reusing cached OAuth tokens.

        TODO:
            from garminconnect import Garmin
            client = Garmin(self._email, self._password)
            client.login(self._token_store)  # resumes from cached tokens if present
            self._client = client
            return client
        """
        raise NotImplementedError("wire up garminconnect.Garmin login + token cache")

    # ── contract methods (stubbed) ──────────────────────────────────────────

    def health_check(self) -> bool:
        raise NotImplementedError

    def fetch_daily(self, day: date) -> DailyBundle:
        """Map per-day endpoints onto a DailyBundle. Sketch:

            c = self._connect()
            iso = day.isoformat()
            summary = c.get_user_summary(iso)
            sleep   = c.get_sleep_data(iso)
            hrv     = c.get_hrv_data(iso)
            stress  = c.get_stress_data(iso)
            battery = c.get_body_battery(iso, iso)

            return DailyBundle(
                day=day,
                raw=[
                    RawRecord("daily_summary", summary, target_date=day),
                    RawRecord("sleep", sleep, target_date=day),
                    RawRecord("hrv", hrv, target_date=day),
                    RawRecord("stress", stress, target_date=day),
                    RawRecord("body_battery", battery, target_date=day),
                ],
                summary=self._map_summary(day, summary, sleep, hrv),
                metrics=[*self._map_stress(stress),
                         *self._map_hrv(hrv),
                         *self._map_body_battery(battery)],
                sleep=self._map_sleep(day, sleep),
                activities=[],  # headers/streams come from list_/fetch_activity
            )
        """
        raise NotImplementedError

    def list_activities(self, start: date, end: date) -> list[str]:
        """e.g. [str(a["activityId"]) for a in c.get_activities_by_date(start, end)]."""
        raise NotImplementedError

    def fetch_activity(self, external_id: str) -> ActivityBundle:
        """Header from get_activity(id); strength sets from
        get_activity_exercise_sets(id); HR zones from
        get_activity_hr_in_timezones(id); per-second stream from the activity
        details endpoint -> ActivitySampleDTO[]."""
        raise NotImplementedError
