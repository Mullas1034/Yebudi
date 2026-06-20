"""Adapter backed by the unofficial ``garminconnect`` library.

Fetches raw payloads and maps them to DTOs (see ``garmin_mapping``). The library
import is lazy (inside the methods) so this module imports fine without the package,
and the mapping layer stays unit-testable on its own.

Auth is token-only on the sync path: ``_connect()`` resumes from cached Garth tokens
in the tokenstore directory and never prompts, so a headless run cannot hang. Use
``login()`` (via ``garmin-ingest login``) once to populate the tokenstore, or drop
token files into the mounted directory.
"""

from __future__ import annotations

import os
import sys
from collections.abc import Callable
from datetime import date
from typing import Any, ClassVar

from ..domain import ActivityBundle, DailyBundle, RawRecord
from . import garmin_mapping as gm
from .base import GarminSource


def _safe(fn: Callable[..., Any], *args: Any) -> Any:
    """Call a Garmin endpoint; on failure warn and return None.

    Keeps one missing/empty endpoint (common for days with no reading) from killing
    the whole day — the rest still lands. Auth failures surface earlier in _connect().
    """
    try:
        return fn(*args)
    except Exception as exc:  # noqa: BLE001
        print(f"  warn: {getattr(fn, '__name__', fn)}{args!r} failed: {exc!r}", file=sys.stderr)
        return None


class GarminConnectSource(GarminSource):
    source_id: ClassVar[str] = "python-garminconnect"

    def __init__(
        self,
        email: str | None = None,
        password: str | None = None,
        token_store: str | None = None,
    ) -> None:
        self._email = email
        self._password = password
        self._token_store = token_store or os.environ.get("GARMINTOKENS") or "~/.garminconnect"
        self._client: Any = None

    # ── auth ────────────────────────────────────────────────────────────────

    def _connect(self) -> Any:
        if self._client is not None:
            return self._client
        from garminconnect import Garmin

        client = Garmin()  # no credentials: resume from cached tokens only
        try:
            client.login(self._token_store)
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(
                f"Garmin token login failed from {self._token_store!r}. Supply valid tokens: "
                f"run `garmin-ingest login` interactively, or copy Garth token files into that "
                f"directory. Underlying error: {exc!r}"
            ) from exc
        self._client = client
        return client

    def login(self) -> None:
        """Interactive credential login (+MFA), persisting tokens to the tokenstore."""
        import getpass

        from garminconnect import Garmin

        email = self._email or input("Garmin email: ").strip()
        password = self._password or getpass.getpass("Garmin password: ")
        client = Garmin(email, password, prompt_mfa=lambda: input("MFA code: ").strip())
        client.login()
        try:
            client.garth.dump(self._token_store)
        except Exception:  # noqa: BLE001 — older/newer APIs persist via login(tokenstore)
            client.login(self._token_store)
        self._client = client
        print(f"Tokens cached to {self._token_store}")

    def health_check(self) -> bool:
        try:
            self._connect()
            return True
        except Exception:  # noqa: BLE001
            return False

    # ── fetch ─────────────────────────────────────────────────────────────────

    def fetch_daily(self, day: date) -> DailyBundle:
        c = self._connect()
        iso = day.isoformat()

        summary = _safe(c.get_user_summary, iso)
        hrv = _safe(c.get_hrv_data, iso)
        stress = _safe(c.get_stress_data, iso)
        battery = _safe(c.get_body_battery, iso, iso)
        sleep = _safe(c.get_sleep_data, iso)
        readiness = _safe(c.get_training_readiness, iso)
        training = _safe(c.get_training_status, iso)
        hr = _safe(c.get_heart_rates, iso)
        respiration = _safe(c.get_respiration_data, iso)

        raw = [
            RawRecord("daily_summary", summary, target_date=day),
            RawRecord("hrv", hrv, target_date=day),
            RawRecord("stress", stress, target_date=day),
            RawRecord("body_battery", battery, target_date=day),
            RawRecord("sleep", sleep, target_date=day),
            RawRecord("training_readiness", readiness, target_date=day),
            RawRecord("training_status", training, target_date=day),
            RawRecord("heart_rate", hr, target_date=day),
            RawRecord("respiration", respiration, target_date=day),
        ]

        metrics = [
            *gm.map_hrv_metrics(hrv),
            *gm.map_stress_metrics(stress),
            *gm.map_body_battery_metrics(battery),
            *gm.map_hr_metrics(hr),
            *gm.map_respiration_metrics(respiration),
        ]

        # Activity headers for the day; full per-activity detail comes from fetch_activity.
        activities: list[ActivityBundle] = []
        for raw_activity in _safe(c.get_activities_by_date, iso, iso) or []:
            dto = gm.map_activity_header(raw_activity)
            if dto is not None:
                activities.append(ActivityBundle(activity=dto))

        return DailyBundle(
            day=day,
            raw=[r for r in raw if r.payload is not None],
            summary=gm.map_daily_summary(
                day, summary=summary, hrv=hrv, sleep=sleep,
                readiness=readiness, training_status=training,
            ),
            metrics=metrics,
            sleep=gm.map_sleep(day, sleep),
            activities=activities,
        )

    def list_activities(self, start: date, end: date) -> list[str]:
        c = self._connect()
        activities = _safe(c.get_activities_by_date, start.isoformat(), end.isoformat()) or []
        return [str(a["activityId"]) for a in activities if a.get("activityId") is not None]

    def fetch_activity(self, external_id: str) -> ActivityBundle:
        c = self._connect()
        header = _safe(c.get_activity, external_id)
        details = _safe(c.get_activity_details, external_id)
        zones = _safe(c.get_activity_hr_in_timezones, external_id)
        sets = _safe(c.get_activity_exercise_sets, external_id)

        dto = gm.map_activity_header(header)
        if dto is None:
            raise RuntimeError(f"could not fetch activity header for {external_id!r}")

        raw = [
            RawRecord("activity", header, external_id=external_id),
            RawRecord("activity_details", details, external_id=external_id),
            RawRecord("activity_zones", zones, external_id=external_id),
            RawRecord("activity_sets", sets, external_id=external_id),
        ]
        return ActivityBundle(
            activity=dto,
            raw=[r for r in raw if r.payload is not None],
            strength_sets=gm.map_exercise_sets(sets),
            zones=gm.map_hr_zones(zones),
            samples=gm.map_activity_samples(details),
        )
